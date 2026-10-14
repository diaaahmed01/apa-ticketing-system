package com.apa.ats.ticket;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import com.apa.ats.permission.AccessGuard;
import com.apa.ats.permission.Condition;
import com.apa.ats.ticket.AttachmentStorage.Checked;
import com.apa.ats.ticket.AttachmentStorage.Stored;
import com.apa.ats.ticket.DiscussionRecords.Attachment;
import com.apa.ats.ticket.DiscussionRecords.Comment;
import com.apa.ats.ticket.DiscussionRecords.Purpose;
import com.apa.ats.ticket.DiscussionViews.AttachmentView;
import com.apa.ats.ticket.DiscussionViews.CommentView;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketViews.Lookup;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/**
 * Comments and attachments. Each write checks, in order: ticket open, permission, then the input
 * (text, file type, size) — and only then writes files, so a refused request leaves nothing on disk.
 * Deleting is soft: rows stay for the audit trail, files stay on disk.
 */
@Service
@RequiredArgsConstructor
public class DiscussionService {

    static final int MAX_BODY = 10_000;
    static final int MAX_FILES = 10;

    private final TicketService tickets;
    private final TicketRecords.People people;
    private final DiscussionRecords.Comments comments;
    private final DiscussionRecords.Attachments attachments;
    private final AttachmentStorage storage;
    private final AccessGuard guard;

    /** A downloadable file: the metadata and where it lives. */
    public record Download(Attachment attachment, Path path) {}

    /* ------------------------------------------------------------------ comments */

    @Transactional(readOnly = true)
    public List<CommentView> comments(Long ticketId) {
        guard.require("TICKET_VIEW");
        Ticket t = tickets.load(ticketId);
        CurrentUser me = CurrentUser.require();
        Lookup l = tickets.lookup();
        List<Comment> cs = comments.findByTicketIdOrderByCreatedAtAscIdAsc(ticketId);
        Map<Long, List<Attachment>> files = cs.isEmpty() ? Map.of()
                : attachments.findByCommentIdInAndDeletedAtIsNullOrderByIdAsc(cs.stream().map(Comment::getId).toList()).stream()
                        .collect(Collectors.groupingBy(Attachment::getCommentId));
        return cs.stream().map(c -> commentView(c, t, me, l, files.getOrDefault(c.getId(), List.of()))).toList();
    }

    @Transactional
    public CommentView addComment(Long ticketId, String body, List<MultipartFile> files) {
        guard.require("TICKET_VIEW");
        Ticket t = tickets.loadOpen(ticketId);
        CurrentUser me = CurrentUser.require();
        Set<Condition> rel = TicketService.relationships(t, people.findByTicketId(ticketId), me.id());
        guard.require("COMMENT_ADD", rel);
        String text = text(body);
        List<MultipartFile> parts = fileParts(files);
        if (!parts.isEmpty()) guard.require("ATTACH_UPLOAD", rel);
        List<Checked> checked = check(parts);

        Comment c = new Comment();
        c.setTicketId(ticketId);
        c.setAuthorId(me.id());
        c.setBody(text);
        c.setCreatedAt(Instant.now());
        c = comments.saveAndFlush(c);
        tickets.log(ticketId, me.id(), "COMMENT_ADDED", "comment", null, null, null);
        List<Attachment> saved = saveFiles(ticketId, c.getId(), Purpose.COMMENT, checked, me.id());

        Lookup l = tickets.lookup();
        return commentView(c, t, me, l, saved);
    }

    @Transactional
    public CommentView editComment(Long commentId, String body) {
        Comment c = loadComment(commentId);
        Ticket t = tickets.loadOpen(c.getTicketId());
        CurrentUser me = CurrentUser.require();
        guard.require("TICKET_VIEW");
        if (c.isDeleted()) throw ApiException.conflict("COMMENT_DELETED", "This comment was deleted.");
        guard.require("COMMENT_EDIT", commentRelationships(c, me));
        String text = text(body);
        if (!text.equals(c.getBody())) {
            c.setBody(text);
            c.setEditedAt(Instant.now());
            comments.saveAndFlush(c);
            tickets.log(t.getId(), me.id(), "COMMENT_EDITED", "comment", null, null, null);
        }
        return commentView(c, t, me, tickets.lookup(), attachments.findByCommentIdAndDeletedAtIsNull(c.getId()));
    }

    @Transactional
    public void deleteComment(Long commentId) {
        Comment c = loadComment(commentId);
        Ticket t = tickets.loadOpen(c.getTicketId());
        CurrentUser me = CurrentUser.require();
        guard.require("TICKET_VIEW");
        if (c.isDeleted()) return;
        guard.require("COMMENT_DELETE", commentRelationships(c, me));
        Instant now = Instant.now();
        c.setDeletedAt(now);
        c.setDeletedBy(me.id());
        comments.saveAndFlush(c);
        tickets.log(t.getId(), me.id(), "COMMENT_DELETED", "comment", null, null, null);
        // Files sent with the comment go with it; they stay on disk and in the table.
        for (Attachment a : attachments.findByCommentIdAndDeletedAtIsNull(c.getId())) {
            a.setDeletedAt(now);
            a.setDeletedBy(me.id());
            attachments.save(a);
            tickets.log(t.getId(), me.id(), "ATTACHMENT_DELETED", "attachment", a.getFileName(), null, null);
        }
    }

    /* ------------------------------------------------------------------ attachments */

    @Transactional(readOnly = true)
    public List<AttachmentView> attachments(Long ticketId) {
        guard.require("TICKET_VIEW");
        Ticket t = tickets.load(ticketId);
        CurrentUser me = CurrentUser.require();
        Lookup l = tickets.lookup();
        return attachments.findByTicketIdAndDeletedAtIsNullOrderByUploadedAtAscIdAsc(ticketId).stream()
                .map(a -> attachmentView(a, t, me, l)).toList();
    }

    /** Adds files to the ticket itself (GENERAL) or as test evidence (EVIDENCE, tester only, while testing). */
    @Transactional
    public List<AttachmentView> upload(Long ticketId, List<MultipartFile> files, String purposeName) {
        guard.require("TICKET_VIEW");
        Ticket t = tickets.loadOpen(ticketId);
        CurrentUser me = CurrentUser.require();
        Set<Condition> rel = TicketService.relationships(t, people.findByTicketId(ticketId), me.id());
        Purpose purpose = purpose(purposeName);
        if (purpose == Purpose.EVIDENCE) {
            guard.require("TEST_UPLOAD_EVIDENCE", rel);
            if (t.getStatus() != Status.TESTING) {
                throw ApiException.conflict("WRONG_STATE", "Test evidence can only be added while the ticket is in testing.");
            }
        } else {
            guard.require("ATTACH_UPLOAD", rel);
        }
        List<MultipartFile> parts = fileParts(files);
        if (parts.isEmpty()) throw ApiException.badRequest("NO_FILE", "Choose at least one file to upload.");
        List<Checked> checked = check(parts);

        List<Attachment> saved = saveFiles(ticketId, null, purpose, checked, me.id());
        Lookup l = tickets.lookup();
        return saved.stream().map(a -> attachmentView(a, t, me, l)).toList();
    }

    @Transactional
    public void deleteAttachment(Long attachmentId) {
        Attachment a = loadAttachment(attachmentId);
        Ticket t = tickets.loadOpen(a.getTicketId());
        CurrentUser me = CurrentUser.require();
        guard.require("TICKET_VIEW");
        guard.require("ATTACH_DELETE", attachmentRelationships(a, me));
        a.setDeletedAt(Instant.now());
        a.setDeletedBy(me.id());
        attachments.saveAndFlush(a);
        tickets.log(t.getId(), me.id(), "ATTACHMENT_DELETED", "attachment", a.getFileName(), null, null);
    }

    @Transactional(readOnly = true)
    public Download download(Long attachmentId) {
        guard.require("TICKET_VIEW");
        Attachment a = loadAttachment(attachmentId);
        Path p = storage.resolve(a.getStorageKey());
        if (!Files.isRegularFile(p)) throw ApiException.notFound("The file");
        return new Download(a, p);
    }

    /* ------------------------------------------------------------------ helpers */

    private Comment loadComment(Long id) {
        return comments.findById(id).orElseThrow(() -> ApiException.notFound("That comment"));
    }

    /** A live attachment; deleted ones look like they never existed. */
    private Attachment loadAttachment(Long id) {
        return attachments.findById(id).filter(a -> !a.isDeleted()).orElseThrow(() -> ApiException.notFound("That attachment"));
    }

    private static Set<Condition> commentRelationships(Comment c, CurrentUser me) {
        return c.getAuthorId().equals(me.id()) ? EnumSet.of(Condition.COMMENT_AUTHOR) : EnumSet.noneOf(Condition.class);
    }

    private static Set<Condition> attachmentRelationships(Attachment a, CurrentUser me) {
        return a.getUploadedBy().equals(me.id()) ? EnumSet.of(Condition.ATTACHMENT_OWNER) : EnumSet.noneOf(Condition.class);
    }

    private CommentView commentView(Comment c, Ticket t, CurrentUser me, Lookup l, List<Attachment> files) {
        boolean open = !t.isClosed();
        Set<Condition> rel = commentRelationships(c, me);
        return DiscussionViews.comment(c, l, files.stream().map(a -> attachmentView(a, t, me, l)).toList(),
                open && guard.allows(me, "COMMENT_EDIT", rel), open && guard.allows(me, "COMMENT_DELETE", rel));
    }

    private AttachmentView attachmentView(Attachment a, Ticket t, CurrentUser me, Lookup l) {
        return DiscussionViews.attachment(a, l, !t.isClosed() && guard.allows(me, "ATTACH_DELETE", attachmentRelationships(a, me)));
    }

    /** Writes the files, then their rows. If the transaction fails for any reason, the files are removed. */
    private List<Attachment> saveFiles(Long ticketId, Long commentId, Purpose purpose, List<Checked> checked, Long actor) {
        List<String> written = new ArrayList<>();
        removeOnRollback(written);
        List<Attachment> out = new ArrayList<>();
        for (Checked ck : checked) {
            Stored s = storage.store(ck.file());
            written.add(s.key());
            Attachment a = new Attachment();
            a.setTicketId(ticketId);
            a.setCommentId(commentId);
            a.setPurpose(purpose);
            a.setFileName(ck.fileName());
            a.setContentType(ck.contentType());
            a.setSizeBytes(s.size());
            a.setSha256(s.sha256());
            a.setStorageKey(s.key());
            a.setUploadedBy(actor);
            a.setUploadedAt(Instant.now());
            out.add(attachments.saveAndFlush(a));
            tickets.log(ticketId, actor, "ATTACHMENT_ADDED", "attachment", null, ck.fileName(), purpose == Purpose.EVIDENCE ? "Test evidence" : null);
        }
        return out;
    }

    /** Deletes the listed files unless the surrounding transaction commits. The list may grow after this call. */
    private void removeOnRollback(List<String> keys) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) keys.forEach(storage::delete);
            }
        });
    }

    private List<Checked> check(List<MultipartFile> parts) {
        return parts.stream().map(storage::check).toList();
    }

    /** The real file parts: browsers send an empty, nameless part when no file was chosen. */
    private static List<MultipartFile> fileParts(List<MultipartFile> files) {
        List<MultipartFile> out = files == null ? List.of() : files.stream()
                .filter(f -> f != null && !(f.isEmpty() && (f.getOriginalFilename() == null || f.getOriginalFilename().isBlank()))).toList();
        if (out.size() > MAX_FILES) throw ApiException.badRequest("TOO_MANY_FILES", "Attach up to " + MAX_FILES + " files at a time.");
        return out;
    }

    private static String text(String v) {
        String s = v == null ? "" : v.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (s.isEmpty()) throw ApiException.badRequest("REQUIRED", "Write something before posting.");
        if (s.length() > MAX_BODY) throw ApiException.badRequest("TOO_LONG", "Keep the comment under 10,000 characters. Attach a file for longer text.");
        return s;
    }

    private static Purpose purpose(String v) {
        if (v == null || v.isBlank() || "GENERAL".equals(v)) return Purpose.GENERAL;
        if ("EVIDENCE".equals(v)) return Purpose.EVIDENCE;
        throw ApiException.badRequest("BAD_VALUE", "Unknown purpose: " + v);
    }
}

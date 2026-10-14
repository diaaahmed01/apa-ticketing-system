package com.apa.ats.ticket;

import com.apa.ats.ticket.DiscussionRecords.Attachment;
import com.apa.ats.ticket.DiscussionRecords.Comment;
import com.apa.ats.ticket.TicketViews.Lookup;
import com.apa.ats.ticket.TicketViews.PersonRef;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/** API shapes for comments and attachments. A deleted comment keeps its row but loses its text and files. */
public final class DiscussionViews {

    private DiscussionViews() {}

    /** Extensions served inline (thumbnails and the preview) when asked with ?inline=1. */
    public static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");

    public record AttachmentCan(boolean delete) {}
    public record CommentCan(boolean edit, boolean delete) {}

    public record AttachmentView(Long id, String fileName, String contentType, long size, String purpose, Long commentId,
                                 PersonRef uploadedBy, Instant uploadedAt, boolean image, AttachmentCan can) {}

    public record CommentView(Long id, PersonRef author, String body, Instant createdAt, Instant editedAt, boolean deleted,
                              List<AttachmentView> attachments, CommentCan can) {}

    static boolean isImage(Attachment a) {
        return IMAGE_EXTENSIONS.contains(AttachmentStorage.extension(a.getFileName()));
    }

    static AttachmentView attachment(Attachment a, Lookup l, boolean canDelete) {
        return new AttachmentView(a.getId(), a.getFileName(), a.getContentType(), a.getSizeBytes(), a.getPurpose().name(),
                a.getCommentId(), l.person(a.getUploadedBy()), a.getUploadedAt(), isImage(a), new AttachmentCan(canDelete));
    }

    static CommentView comment(Comment c, Lookup l, List<AttachmentView> files, boolean canEdit, boolean canDelete) {
        boolean gone = c.isDeleted();
        return new CommentView(c.getId(), l.person(c.getAuthorId()), gone ? "" : c.getBody(), c.getCreatedAt(), c.getEditedAt(),
                gone, gone ? List.of() : files, new CommentCan(!gone && canEdit, !gone && canDelete));
    }
}

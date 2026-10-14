package com.apa.ats.ticket;

import com.apa.ats.ticket.DiscussionRecords.Attachment;
import com.apa.ats.ticket.DiscussionViews.AttachmentView;
import com.apa.ats.ticket.DiscussionViews.CommentView;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Comments and attachments. Uploads are multipart; downloads stream the stored file. */
@RestController
@RequiredArgsConstructor
public class DiscussionController {

    private final DiscussionService service;

    public record CommentRequest(String body) {}

    @GetMapping("/api/tickets/{id}/comments")
    public List<CommentView> comments(@PathVariable Long id) {
        return service.comments(id);
    }

    @PostMapping(path = "/api/tickets/{id}/comments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CommentView addComment(@PathVariable Long id, @RequestParam(required = false) String body,
                                  @RequestParam(name = "files", required = false) List<MultipartFile> files) {
        return service.addComment(id, body, files);
    }

    @PutMapping("/api/comments/{commentId}")
    public CommentView editComment(@PathVariable Long commentId, @RequestBody CommentRequest r) {
        return service.editComment(commentId, r.body());
    }

    @DeleteMapping("/api/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable Long commentId) {
        service.deleteComment(commentId);
    }

    @GetMapping("/api/tickets/{id}/attachments")
    public List<AttachmentView> attachments(@PathVariable Long id) {
        return service.attachments(id);
    }

    @PostMapping(path = "/api/tickets/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<AttachmentView> upload(@PathVariable Long id, @RequestParam(name = "files", required = false) List<MultipartFile> files,
                                       @RequestParam(required = false) String purpose) {
        return service.upload(id, files, purpose);
    }

    @DeleteMapping("/api/attachments/{attId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAttachment(@PathVariable Long attId) {
        service.deleteAttachment(attId);
    }

    /** Always a download, except images asked for with ?inline=1 (thumbnails and the preview). */
    @GetMapping("/api/attachments/{attId}")
    public ResponseEntity<Resource> download(@PathVariable Long attId, @RequestParam(defaultValue = "0") String inline) {
        DiscussionService.Download d = service.download(attId);
        Attachment a = d.attachment();
        boolean show = ("1".equals(inline) || "true".equals(inline)) && DiscussionViews.isImage(a);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition(show ? "inline" : "attachment", a.getFileName()))
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .header(HttpHeaders.CACHE_CONTROL, show ? "private, max-age=300" : "private, no-cache")
                .body(new FileSystemResource(d.path()));
    }

    /** RFC 6266 / 5987: an ASCII fallback plus the real name percent-encoded as UTF-8. */
    static String disposition(String kind, String fileName) {
        String ascii = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        String encoded = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20").replace("*", "%2A");
        return kind + "; filename=\"" + ascii + "\"; filename*=UTF-8''" + encoded;
    }
}

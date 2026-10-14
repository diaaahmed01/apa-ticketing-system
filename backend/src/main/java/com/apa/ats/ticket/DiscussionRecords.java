package com.apa.ats.ticket;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Nationalized;
import org.springframework.data.jpa.repository.JpaRepository;

/** Comments and attachments on a ticket, and their repositories. Rows are never hard-deleted. */
public final class DiscussionRecords {

    private DiscussionRecords() {}

    public enum Purpose { GENERAL, COMMENT, EVIDENCE }

    @Getter
    @Setter
    @Entity
    @Table(name = "ATS_TICKET_COMMENTS")
    public static class Comment {
        @Id
        @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_ticket_comments_seq")
        @SequenceGenerator(name = "ats_ticket_comments_seq", sequenceName = "ATS_TICKET_COMMENTS_SEQ", allocationSize = 1)
        private Long id;
        private Long ticketId;
        private Long authorId;
        @Lob
        @Nationalized
        private String body;
        private Instant createdAt;
        private Instant editedAt;
        private Instant deletedAt;
        private Long deletedBy;
        @Version
        private int version;

        public boolean isDeleted() { return deletedAt != null; }
    }

    @Getter
    @Setter
    @Entity
    @Table(name = "ATS_ATTACHMENTS")
    public static class Attachment {
        @Id
        @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_attachments_seq")
        @SequenceGenerator(name = "ats_attachments_seq", sequenceName = "ATS_ATTACHMENTS_SEQ", allocationSize = 1)
        private Long id;
        private Long ticketId;
        private Long commentId;
        @Enumerated(EnumType.STRING)
        private Purpose purpose;
        @Nationalized
        private String fileName;
        private String contentType;
        private long sizeBytes;
        private String sha256;
        private String storageKey;
        private Long uploadedBy;
        private Instant uploadedAt;
        private Instant deletedAt;
        private Long deletedBy;

        public boolean isDeleted() { return deletedAt != null; }
    }

    public interface Comments extends JpaRepository<Comment, Long> {
        List<Comment> findByTicketIdOrderByCreatedAtAscIdAsc(Long ticketId);
        int countByTicketIdAndDeletedAtIsNull(Long ticketId);
    }

    public interface Attachments extends JpaRepository<Attachment, Long> {
        List<Attachment> findByTicketIdAndDeletedAtIsNullOrderByUploadedAtAscIdAsc(Long ticketId);
        List<Attachment> findByCommentIdInAndDeletedAtIsNullOrderByIdAsc(Collection<Long> commentIds);
        List<Attachment> findByCommentIdAndDeletedAtIsNull(Long commentId);
        int countByTicketIdAndDeletedAtIsNull(Long ticketId);
    }
}

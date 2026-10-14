package com.apa.ats.notification;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Nationalized;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** In-app notifications and the email outbox, with their repositories. */
public final class NotificationRecords {

    private NotificationRecords() {}

    public enum MailStatus { PENDING, SENT, FAILED, SKIPPED }

    @Getter
    @Setter
    @Entity(name = "Notification")
    @Table(name = "ATS_NOTIFICATIONS")
    public static class Notification {
        @Id
        @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_notifications_seq")
        @SequenceGenerator(name = "ats_notifications_seq", sequenceName = "ATS_NOTIFICATIONS_SEQ", allocationSize = 1)
        private Long id;
        private Long userId;
        private Long ticketId;
        private String type;
        private Long actorId;
        @Nationalized private String title;
        @Nationalized private String body;
        private Instant createdAt;
        private Instant readAt;
    }

    @Getter
    @Setter
    @Entity(name = "EmailOutbox")
    @Table(name = "ATS_EMAIL_OUTBOX")
    public static class EmailOutbox {
        @Id
        @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_email_outbox_seq")
        @SequenceGenerator(name = "ats_email_outbox_seq", sequenceName = "ATS_EMAIL_OUTBOX_SEQ", allocationSize = 1)
        private Long id;
        private String toAddress;
        @Nationalized private String subject;
        @Lob
        @Nationalized
        private String bodyText;
        private Long notificationId;
        @Enumerated(EnumType.STRING)
        private MailStatus status;
        private int attempts;
        @Nationalized private String lastError;
        private Instant createdAt;
        private Instant sentAt;
    }

    public interface Notifications extends JpaRepository<Notification, Long> {

        Page<Notification> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable page);

        Page<Notification> findByUserIdAndReadAtIsNullOrderByCreatedAtDescIdDesc(Long userId, Pageable page);

        long countByUserIdAndReadAtIsNull(Long userId);

        @Transactional
        @Modifying
        @Query("update Notification n set n.readAt = :now where n.id = :id and n.userId = :userId and n.readAt is null")
        int markRead(@Param("id") Long id, @Param("userId") Long userId, @Param("now") Instant now);

        @Transactional
        @Modifying
        @Query("update Notification n set n.readAt = :now where n.userId = :userId and n.readAt is null")
        int markAllRead(@Param("userId") Long userId, @Param("now") Instant now);
    }

    public interface Outbox extends JpaRepository<EmailOutbox, Long> {
        List<EmailOutbox> findTop20ByStatusOrderByCreatedAtAscIdAsc(MailStatus status);
    }
}

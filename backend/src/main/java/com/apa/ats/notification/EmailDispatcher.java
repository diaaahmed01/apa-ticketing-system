package com.apa.ats.notification;

import com.apa.ats.config.AtsProperties;
import com.apa.ats.notification.NotificationRecords.EmailOutbox;
import com.apa.ats.notification.NotificationRecords.MailStatus;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Sends queued emails from ATS_EMAIL_OUTBOX, a few at a time, while {@code ats.mail.enabled} is true.
 * While it is off the rows simply stay PENDING. A message is retried until {@value #MAX_ATTEMPTS} attempts have failed.
 */
@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class EmailDispatcher implements ApplicationRunner {

    static final int MAX_ATTEMPTS = 5;

    private final NotificationRecords.Outbox outbox;
    private final SmtpSender smtp;
    private final AtsProperties props;

    @Override
    public void run(ApplicationArguments args) {
        AtsProperties.Mail mail = props.mail();
        if (mail == null || !mail.enabled()) {
            log.info("Email sending is off (ATS_MAIL_ENABLED=false); emails are queued in ATS_EMAIL_OUTBOX.");
        } else {
            log.info("Email sending is on: {}:{}, from {}{}", mail.host(), mail.port(), mail.from(), mail.starttls() ? " (STARTTLS)" : "");
        }
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    public void sendPending() {
        AtsProperties.Mail mail = props.mail();
        if (mail == null || !mail.enabled()) return;
        try {
            for (EmailOutbox row : outbox.findTop20ByStatusOrderByCreatedAtAscIdAsc(MailStatus.PENDING)) {
                deliver(mail, row);
            }
        } catch (RuntimeException e) {
            log.warn("Email job could not read the outbox: {}", e.toString());
        }
    }

    /** Tries one message right away (used by the settings page); returns the saved row with its new status. */
    public EmailOutbox sendNow(EmailOutbox row) {
        deliver(props.mail(), row);
        return row;
    }

    private void deliver(AtsProperties.Mail mail, EmailOutbox row) {
        try {
            smtp.send(mail, row.getToAddress(), row.getSubject(), row.getBodyText());
            row.setStatus(MailStatus.SENT);
            row.setSentAt(Instant.now());
            row.setLastError(null);
            row.setAttempts(row.getAttempts() + 1);
        } catch (IllegalArgumentException e) {
            // A bad recipient address will never work; don't keep retrying it.
            row.setStatus(MailStatus.SKIPPED);
            row.setLastError(clip(e.getMessage()));
        } catch (Exception e) {
            row.setAttempts(row.getAttempts() + 1);
            row.setLastError(clip(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            if (row.getAttempts() >= MAX_ATTEMPTS) row.setStatus(MailStatus.FAILED);
            log.warn("Email {} to {} failed (attempt {}): {}", row.getId(), row.getToAddress(), row.getAttempts(), row.getLastError());
        }
        try {
            outbox.save(row);
        } catch (RuntimeException e) {
            log.warn("Couldn't record the result for email {}: {}", row.getId(), e.toString());
        }
    }

    private static String clip(String s) {
        if (s == null) return null;
        return s.length() <= 1000 ? s : s.substring(0, 999) + "…";
    }
}

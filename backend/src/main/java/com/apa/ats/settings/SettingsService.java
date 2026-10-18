package com.apa.ats.settings;

import com.apa.ats.common.ApiException;
import com.apa.ats.config.AtsProperties;
import com.apa.ats.notification.EmailDispatcher;
import com.apa.ats.notification.NotificationRecords.EmailOutbox;
import com.apa.ats.notification.NotificationRecords.MailStatus;
import com.apa.ats.notification.NotificationRecords.Outbox;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Read-only view of the server's configuration and mail state, plus the "send a test email" action. */
@Service
@RequiredArgsConstructor
public class SettingsService {

    private static final Pattern ADDRESS = Pattern.compile("^[^\\s@<>\"]+@[^\\s@<>\"]+\\.[^\\s@<>\"]+$");

    private final AtsProperties props;
    private final JdbcTemplate jdbc;
    private final Outbox outbox;
    private final EmailDispatcher dispatcher;
    private final ObjectProvider<BuildProperties> build;

    public record EmailInfo(boolean enabled, String host, int port, String from, boolean starttls, boolean authConfigured) {}
    public record OutboxInfo(long pending, long sent, long failed, long skipped, String lastError, Instant lastErrorAt, Instant lastSentAt) {}
    public record AttachmentsInfo(String dir, int maxMb, long usedBytes) {}
    public record DatabaseInfo(Integer schemaVersion) {}
    public record Settings(EmailInfo email, OutboxInfo outbox, AttachmentsInfo attachments, String publicUrl, String version,
                           DatabaseInfo database) {}
    public record TestEmailResult(String status, String error) {}

    public Settings get() {
        AtsProperties.Mail m = props.mail();
        EmailInfo email = new EmailInfo(m.enabled(), m.host(), m.port(), m.from(), m.starttls(),
                m.username() != null && !m.username().isBlank());

        long[] counts = new long[4];
        jdbc.query("SELECT STATUS, COUNT(*) FROM ATS_EMAIL_OUTBOX GROUP BY STATUS", rs -> {
            switch (rs.getString(1)) {
                case "PENDING" -> counts[0] = rs.getLong(2);
                case "SENT" -> counts[1] = rs.getLong(2);
                case "FAILED" -> counts[2] = rs.getLong(2);
                case "SKIPPED" -> counts[3] = rs.getLong(2);
                default -> { }
            }
        });
        String lastError = null;
        Instant lastErrorAt = null;
        List<Object[]> errs = jdbc.query(
                "SELECT LAST_ERROR, CREATED_AT FROM ATS_EMAIL_OUTBOX WHERE LAST_ERROR IS NOT NULL ORDER BY CREATED_AT DESC, ID DESC FETCH FIRST 1 ROWS ONLY",
                (rs, i) -> new Object[] {rs.getString(1), rs.getTimestamp(2)});
        if (!errs.isEmpty()) {
            lastError = (String) errs.get(0)[0];
            lastErrorAt = instant((Timestamp) errs.get(0)[1]);
        }
        Instant lastSentAt = instant(jdbc.queryForObject("SELECT MAX(SENT_AT) FROM ATS_EMAIL_OUTBOX", Timestamp.class));
        OutboxInfo ob = new OutboxInfo(counts[0], counts[1], counts[2], counts[3], lastError, lastErrorAt, lastSentAt);

        Long used = jdbc.queryForObject("SELECT NVL(SUM(SIZE_BYTES), 0) FROM ATS_ATTACHMENTS WHERE DELETED_AT IS NULL", Long.class);
        AttachmentsInfo att = new AttachmentsInfo(Path.of(props.attachments().dir()).toAbsolutePath().normalize().toString(),
                props.attachments().maxMb(), used == null ? 0 : used);

        Integer schema = jdbc.queryForObject("SELECT MAX(VERSION) FROM ATS_SCHEMA_HISTORY", Integer.class);
        BuildProperties bp = build.getIfAvailable();
        return new Settings(email, ob, att, props.publicUrl(), bp == null || bp.getVersion() == null ? "dev" : bp.getVersion(),
                new DatabaseInfo(schema));
    }

    public TestEmailResult sendTest(String to) {
        String address = to == null ? "" : to.strip();
        if (address.length() > 320 || !ADDRESS.matcher(address).matches()) {
            throw ApiException.badRequest("INVALID_EMAIL", "Enter a valid email address.");
        }
        EmailOutbox row = new EmailOutbox();
        row.setToAddress(address);
        row.setSubject("ATS test email");
        row.setBodyText("This is a test email from ATS (APA Ticketing System).\n\nIf you received it, outgoing email is working.\n");
        row.setStatus(MailStatus.PENDING);
        row.setAttempts(0);
        row.setCreatedAt(Instant.now());
        row = outbox.save(row);

        if (!props.mail().enabled()) {
            return new TestEmailResult("QUEUED", "Email sending is off (ATS_MAIL_ENABLED=false). The test email was queued and will be sent once sending is turned on.");
        }
        row = dispatcher.sendNow(row);
        return switch (row.getStatus()) {
            case SENT -> new TestEmailResult("SENT", null);
            default -> {
                // A test message is not retried in the background.
                row.setStatus(MailStatus.FAILED);
                outbox.save(row);
                yield new TestEmailResult("FAILED", row.getLastError() == null ? "The message could not be sent." : row.getLastError());
            }
        };
    }

    private static Instant instant(Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}

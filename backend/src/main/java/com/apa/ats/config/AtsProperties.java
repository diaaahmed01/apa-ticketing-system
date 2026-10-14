package com.apa.ats.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ats")
public record AtsProperties(Db db, Security security, BootstrapAdmin bootstrapAdmin, Cors cors, Attachments attachments,
                            String publicUrl, Mail mail) {

    public record Db(boolean migrate) {}

    public record Security(
            String jwtSecret,
            int sessionHours,
            String cookieName,
            boolean cookieSecure,
            int maxFailedLogins,
            int lockMinutes) {}

    public record BootstrapAdmin(String username, String fullName, String email, String initialPassword) {}

    public record Cors(List<String> allowedOrigins) {}

    /** Where attachment files live (relative paths resolve against the backend working directory) and the per-file limit. */
    public record Attachments(String dir, int maxMb) {}

    /**
     * Outgoing mail. Sending is off by default; notifications are queued in ATS_EMAIL_OUTBOX either way.
     * With a blank {@code username} the SMTP login step is skipped.
     */
    public record Mail(boolean enabled, String host, int port, String from, String username, String password, boolean starttls) {

        /** Never prints the password. */
        @Override
        public String toString() {
            return "Mail[enabled=" + enabled + ", host=" + host + ", port=" + port + ", from=" + from + ", starttls=" + starttls + "]";
        }
    }
}

package com.apa.ats.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ats")
public record AtsProperties(Db db, Security security, BootstrapAdmin bootstrapAdmin, Cors cors) {

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
}

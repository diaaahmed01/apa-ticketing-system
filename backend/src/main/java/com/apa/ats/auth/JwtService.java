package com.apa.ats.auth;

import com.apa.ats.config.AtsProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class JwtService {

    private static final String ISSUER = "ats";

    private final SecretKey key;
    private final Duration ttl;

    public record Session(Long userId, Instant issuedAt) {}

    public JwtService(AtsProperties props) {
        String secret = props.security().jwtSecret();
        byte[] bytes;
        if (secret == null || secret.isBlank()) {
            bytes = new byte[64];
            new SecureRandom().nextBytes(bytes);
            log.warn("ATS_JWT_SECRET is not set: using a random key, so every restart signs everyone out. Set it for shared environments.");
        } else {
            bytes = secret.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < 32) throw new IllegalStateException("ATS_JWT_SECRET must be at least 32 bytes.");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.ttl = Duration.ofHours(props.security().sessionHours());
    }

    public Duration ttl() { return ttl; }

    public String issue(Long userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public Optional<Session> parse(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).requireIssuer(ISSUER).build().parseSignedClaims(token).getPayload();
            return Optional.of(new Session(Long.valueOf(c.getSubject()), c.getIssuedAt().toInstant()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}

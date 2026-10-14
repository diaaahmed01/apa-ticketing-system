package com.apa.ats.auth;

import com.apa.ats.common.ApiException;
import com.apa.ats.common.Passwords;
import com.apa.ats.config.AtsProperties;
import com.apa.ats.user.AtsUser;
import com.apa.ats.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String BAD_CREDENTIALS = "Username or password is incorrect.";

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AtsProperties props;

    // Compared against when the username doesn't exist, so response time doesn't reveal it.
    private String dummyHash;

    /**
     * Checks credentials and returns the user. Runs in its own transaction so a failed
     * attempt counter is committed even though the request ends with an error.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public AtsUser authenticate(String username, String password) {
        if (username == null || password == null || username.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", BAD_CREDENTIALS);
        }
        AtsUser u = users.findByUsernameIgnoreCase(username.strip()).orElse(null);
        if (u == null) {
            encoder.matches(password, dummyHash());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", BAD_CREDENTIALS);
        }
        Instant now = Instant.now();
        if (u.isLocked(now)) {
            long minutes = Math.max(1, Duration.between(now, u.getLockedUntil()).toMinutes() + 1);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "LOCKED",
                    "Too many failed attempts. Try again in " + minutes + " minute" + (minutes == 1 ? "" : "s") + ".");
        }
        if (!encoder.matches(password, u.getPasswordHash())) {
            int failed = u.getFailedLogins() + 1;
            if (failed >= props.security().maxFailedLogins()) {
                u.setLockedUntil(now.plus(Duration.ofMinutes(props.security().lockMinutes())));
                u.setFailedLogins(0);
            } else {
                u.setFailedLogins(failed);
            }
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", BAD_CREDENTIALS);
        }
        if (!u.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "DEACTIVATED",
                    "This account is deactivated. Contact the system administrator.");
        }
        u.setFailedLogins(0);
        u.setLockedUntil(null);
        u.setLastLoginAt(now);
        return u;
    }

    @Transactional
    public void changePassword(Long userId, String current, String next) {
        AtsUser u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        if (current == null || !encoder.matches(current, u.getPasswordHash())) {
            throw ApiException.badRequest("WRONG_CURRENT_PASSWORD", "Your current password is incorrect.");
        }
        String problem = Passwords.policyViolation(next, u.getUsername());
        if (problem != null) throw ApiException.badRequest("WEAK_PASSWORD", problem);
        if (encoder.matches(next, u.getPasswordHash())) {
            throw ApiException.badRequest("SAME_PASSWORD", "Choose a password different from the current one.");
        }
        u.setPasswordHash(encoder.encode(next));
        u.setMustChangePassword(false);
        u.setPasswordChangedAt(Instant.now());
        u.setUpdatedAt(Instant.now());
        u.setUpdatedBy(userId);
    }

    private String dummyHash() {
        if (dummyHash == null) dummyHash = encoder.encode(Passwords.temporary());
        return dummyHash;
    }
}

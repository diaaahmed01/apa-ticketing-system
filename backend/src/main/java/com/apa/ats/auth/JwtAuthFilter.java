package com.apa.ats.auth;

import com.apa.ats.config.AtsProperties;
import com.apa.ats.user.AtsUser;
import com.apa.ats.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates each request from the ATS session cookie (or a Bearer token). The user is
 * re-read from the database every time, so deactivating a user or resetting their password
 * takes effect immediately rather than when the token expires.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    /** Endpoints still reachable while a password change is pending. */
    private static final Set<String> PASSWORD_CHANGE_ALLOWED = Set.of("/api/auth/me", "/api/auth/change-password", "/api/auth/logout");

    private final JwtService jwt;
    private final UserRepository users;
    private final AtsProperties props;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Optional<String> token = token(req);
        if (token.isPresent()) {
            jwt.parse(token.get())
                    .flatMap(s -> users.findById(s.userId()).filter(u -> valid(u, s)))
                    .ifPresent(u -> {
                        CurrentUser cu = CurrentUser.of(u);
                        var auth = new UsernamePasswordAuthenticationToken(cu, null, List.of());
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    });
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CurrentUser cu && cu.mustChangePassword()
                && req.getRequestURI().startsWith("/api/") && !PASSWORD_CHANGE_ALLOWED.contains(req.getRequestURI())) {
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"PASSWORD_CHANGE_REQUIRED\",\"message\":\"Choose a new password before continuing.\"}");
            return;
        }
        chain.doFilter(req, res);
    }

    private static boolean valid(AtsUser u, JwtService.Session s) {
        // Tokens issued before the last password change (or reset) are void.
        return u.isActive() && u.getPasswordChangedAt().getEpochSecond() <= s.issuedAt().getEpochSecond();
    }

    private Optional<String> token(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) return Optional.of(header.substring(7));
        if (req.getCookies() == null) return Optional.empty();
        for (Cookie c : req.getCookies()) {
            if (props.security().cookieName().equals(c.getName()) && !c.getValue().isBlank()) return Optional.of(c.getValue());
        }
        return Optional.empty();
    }
}

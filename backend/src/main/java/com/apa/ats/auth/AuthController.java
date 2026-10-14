package com.apa.ats.auth;

import com.apa.ats.config.AtsProperties;
import com.apa.ats.permission.AccessGuard;
import com.apa.ats.user.AtsUser;
import com.apa.ats.user.Role;
import com.apa.ats.user.UserRepository;
import com.apa.ats.common.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;
    private final JwtService jwt;
    private final UserRepository users;
    private final AccessGuard guard;
    private final AtsProperties props;

    public record LoginRequest(String username, String password) {}
    public record ChangePasswordRequest(String currentPassword, String newPassword) {}
    public record RoleRef(String code, String name, String nameAr) {}
    public record Me(Long id, String username, String fullName, String email, String organization,
                     String avatarColor, String preferredLang, boolean mustChangePassword,
                     List<RoleRef> roles, Map<String, Set<String>> permissions) {}

    @PostMapping("/login")
    public Me login(@RequestBody LoginRequest body, HttpServletResponse res) {
        AtsUser u = auth.authenticate(body.username(), body.password());
        setCookie(res, jwt.issue(u.getId()), jwt.ttl());
        return me(u);
    }

    @PostMapping("/logout")
    public Map<String, Boolean> logout(HttpServletResponse res) {
        setCookie(res, "", Duration.ZERO);
        return Map.of("ok", true);
    }

    @GetMapping("/me")
    public Me me() {
        return me(load(CurrentUser.require().id()));
    }

    @PostMapping("/change-password")
    public Me changePassword(@RequestBody ChangePasswordRequest body, HttpServletResponse res) {
        Long id = CurrentUser.require().id();
        auth.changePassword(id, body.currentPassword(), body.newPassword());
        // The change voided every existing session, including this one; issue a fresh token.
        setCookie(res, jwt.issue(id), jwt.ttl());
        return me(load(id));
    }

    private AtsUser load(Long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    private Me me(AtsUser u) {
        return new Me(u.getId(), u.getUsername(), u.getFullName(), u.getEmail(), u.getOrganization().name(),
                u.getAvatarColor(), u.getPreferredLang(), u.isMustChangePassword(),
                u.getRoles().stream().sorted(Comparator.comparingInt(Role::getSortOrder))
                        .map(r -> new RoleRef(r.getCode(), r.getName(), r.getNameAr())).toList(),
                guard.grantsOf(CurrentUser.of(u)));
    }

    private void setCookie(HttpServletResponse res, String value, Duration maxAge) {
        ResponseCookie cookie = ResponseCookie.from(props.security().cookieName(), value)
                .httpOnly(true)
                .secure(props.security().cookieSecure())
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge)
                .build();
        res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}

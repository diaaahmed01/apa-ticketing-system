package com.apa.ats.user;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import com.apa.ats.common.Passwords;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9._-]{3,60}");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    private static final Pattern COLOR = Pattern.compile("#[0-9A-Fa-f]{6}");
    private static final List<String> PALETTE = List.of(
            "#2878E3", "#14283F", "#6D4FD8", "#A1479E", "#0F8A80", "#B7791F", "#0B7FA8", "#D9572A", "#3B4F66");

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;

    public record UserInput(String username, String fullName, String email, String organization,
                            String preferredLang, String avatarColor, List<String> roles) {}

    /** A newly created or reset account, with its one-time temporary password. */
    public record Issued(AtsUser user, String temporaryPassword) {}

    @Transactional(readOnly = true)
    public List<AtsUser> list() {
        return users.findAllWithRoles();
    }

    @Transactional(readOnly = true)
    public AtsUser get(Long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    @Transactional
    public Issued create(UserInput in) {
        String username = required(in.username(), "Username").strip();
        if (!USERNAME.matcher(username).matches()) {
            throw ApiException.badRequest("BAD_USERNAME", "Usernames are 3–60 characters: letters, numbers, dot, dash or underscore.");
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            throw ApiException.conflict("USERNAME_TAKEN", "The username \"" + username + "\" is already in use.");
        }
        AtsUser u = new AtsUser();
        u.setUsername(username);
        applyProfile(u, in, null);
        u.setRoles(resolveRoles(in.roles()));
        String temp = Passwords.temporary();
        u.setPasswordHash(encoder.encode(temp));
        u.setMustChangePassword(true);
        u.setActive(true);
        if (u.getAvatarColor() == null) u.setAvatarColor(PALETTE.get(Math.floorMod(username.hashCode(), PALETTE.size())));
        u.setCreatedBy(CurrentUser.require().id());
        return new Issued(users.save(u), temp);
    }

    @Transactional
    public AtsUser update(Long id, UserInput in) {
        AtsUser u = get(id);
        applyProfile(u, in, id);
        touch(u);
        return u;
    }

    @Transactional
    public AtsUser setRoles(Long id, List<String> roleCodes) {
        AtsUser u = get(id);
        Set<Role> next = resolveRoles(roleCodes);
        boolean losesAdmin = u.hasRole(Role.SYS_ADMIN) && next.stream().noneMatch(r -> Role.SYS_ADMIN.equals(r.getCode()));
        if (losesAdmin && u.isActive()) guardLastAdmin();
        u.getRoles().clear();
        u.getRoles().addAll(next);
        touch(u);
        return u;
    }

    @Transactional
    public AtsUser setActive(Long id, boolean active) {
        AtsUser u = get(id);
        if (u.isActive() == active) return u;
        if (!active) {
            if (id.equals(CurrentUser.require().id())) {
                throw ApiException.conflict("SELF_DEACTIVATION", "You can't deactivate your own account.");
            }
            if (u.hasRole(Role.SYS_ADMIN)) guardLastAdmin();
        }
        u.setActive(active);
        if (active) { u.setFailedLogins(0); u.setLockedUntil(null); }
        touch(u);
        return u;
    }

    @Transactional
    public Issued resetPassword(Long id) {
        AtsUser u = get(id);
        String temp = Passwords.temporary();
        u.setPasswordHash(encoder.encode(temp));
        u.setMustChangePassword(true);
        u.setPasswordChangedAt(Instant.now()); // signs the user out everywhere
        u.setFailedLogins(0);
        u.setLockedUntil(null);
        touch(u);
        return new Issued(u, temp);
    }

    private void applyProfile(AtsUser u, UserInput in, Long selfId) {
        u.setFullName(required(in.fullName(), "Full name").strip());
        if (u.getFullName().length() > 150) throw ApiException.badRequest("BAD_NAME", "Full name is too long (150 characters max).");

        String email = in.email() == null || in.email().isBlank() ? null : in.email().strip();
        if (email != null && !EMAIL.matcher(email).matches()) throw ApiException.badRequest("BAD_EMAIL", "Enter a valid email address.");
        if (email != null && users.emailTaken(email, selfId)) throw ApiException.conflict("EMAIL_TAKEN", "Another user already has this email.");
        u.setEmail(email);

        try {
            u.setOrganization(AtsUser.Organization.valueOf(required(in.organization(), "Organization")));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("BAD_ORGANIZATION", "Organization must be PORT or VENDOR.");
        }
        if (in.preferredLang() != null) {
            if (!Set.of("en", "ar").contains(in.preferredLang())) throw ApiException.badRequest("BAD_LANG", "Language must be en or ar.");
            u.setPreferredLang(in.preferredLang());
        }
        if (in.avatarColor() != null) {
            if (!COLOR.matcher(in.avatarColor()).matches()) throw ApiException.badRequest("BAD_COLOR", "Avatar color must look like #2878E3.");
            u.setAvatarColor(in.avatarColor());
        }
    }

    private Set<Role> resolveRoles(List<String> codes) {
        if (codes == null || codes.isEmpty()) throw ApiException.badRequest("NO_ROLES", "Give the user at least one role.");
        Set<Role> out = new LinkedHashSet<>();
        for (String code : codes) {
            out.add(roles.findByCode(code).orElseThrow(() -> ApiException.badRequest("UNKNOWN_ROLE", "Unknown role: " + code)));
        }
        return out;
    }

    private void guardLastAdmin() {
        if (users.countActiveWithRole(Role.SYS_ADMIN) <= 1) {
            throw ApiException.conflict("LAST_ADMIN", "This is the last active System Administrator. Give the role to someone else first.");
        }
    }

    private static void touch(AtsUser u) {
        u.setUpdatedAt(Instant.now());
        u.setUpdatedBy(CurrentUser.require().id());
    }

    private static String required(String v, String field) {
        if (v == null || v.isBlank()) throw ApiException.badRequest("REQUIRED", field + " is required.");
        return v;
    }

    static Comparator<Role> roleOrder() {
        return Comparator.comparingInt(Role::getSortOrder);
    }
}

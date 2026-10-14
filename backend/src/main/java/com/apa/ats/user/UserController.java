package com.apa.ats.user;

import com.apa.ats.permission.AccessGuard;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService service;
    private final RoleRepository roles;
    private final AccessGuard guard;

    public record RoleRef(String code, String name, String nameAr) {}
    public record UserView(Long id, String username, String fullName, String email, String organization,
                           boolean active, boolean mustChangePassword, boolean locked, String avatarColor,
                           String preferredLang, List<RoleRef> roles, Instant lastLoginAt, Instant createdAt) {}
    /** Minimal public profile for pickers (assignee, reviewer, tester). */
    public record DirectoryEntry(Long id, String fullName, String organization, String avatarColor, List<String> roles) {}
    public record IssuedView(UserView user, String temporaryPassword) {}
    public record RolesRequest(List<String> roles) {}

    @GetMapping("/api/users")
    public List<UserView> list() {
        guard.require("USER_VIEW");
        return service.list().stream().map(UserController::view).toList();
    }

    @GetMapping("/api/users/{id}")
    public UserView get(@PathVariable Long id) {
        guard.require("USER_VIEW");
        return view(service.get(id));
    }

    /** Active users, for anyone signed in: needed to pick assignees, reviewers and testers. */
    @GetMapping("/api/users/directory")
    public List<DirectoryEntry> directory() {
        return service.list().stream().filter(AtsUser::isActive)
                .map(u -> new DirectoryEntry(u.getId(), u.getFullName(), u.getOrganization().name(), u.getAvatarColor(),
                        u.getRoles().stream().sorted(UserService.roleOrder()).map(Role::getCode).toList()))
                .toList();
    }

    @PostMapping("/api/users")
    @ResponseStatus(HttpStatus.CREATED)
    public IssuedView create(@RequestBody UserService.UserInput in) {
        guard.require("USER_MANAGE");
        if (in.roles() != null && !in.roles().isEmpty()) guard.require("USER_ASSIGN_ROLES");
        UserService.Issued issued = service.create(in);
        return new IssuedView(view(issued.user()), issued.temporaryPassword());
    }

    @PutMapping("/api/users/{id}")
    public UserView update(@PathVariable Long id, @RequestBody UserService.UserInput in) {
        guard.require("USER_MANAGE");
        return view(service.update(id, in));
    }

    @PutMapping("/api/users/{id}/roles")
    public UserView setRoles(@PathVariable Long id, @RequestBody RolesRequest body) {
        guard.require("USER_ASSIGN_ROLES");
        return view(service.setRoles(id, body.roles()));
    }

    @PostMapping("/api/users/{id}/activate")
    public UserView activate(@PathVariable Long id) {
        guard.require("USER_MANAGE");
        return view(service.setActive(id, true));
    }

    @PostMapping("/api/users/{id}/deactivate")
    public UserView deactivate(@PathVariable Long id) {
        guard.require("USER_MANAGE");
        return view(service.setActive(id, false));
    }

    @PostMapping("/api/users/{id}/reset-password")
    public IssuedView resetPassword(@PathVariable Long id) {
        guard.require("USER_RESET_PASSWORD");
        UserService.Issued issued = service.resetPassword(id);
        return new IssuedView(view(issued.user()), issued.temporaryPassword());
    }

    @GetMapping("/api/roles")
    public List<RoleRef> roles() {
        return roles.findAllByOrderBySortOrderAsc().stream().map(r -> new RoleRef(r.getCode(), r.getName(), r.getNameAr())).toList();
    }

    static UserView view(AtsUser u) {
        return new UserView(u.getId(), u.getUsername(), u.getFullName(), u.getEmail(), u.getOrganization().name(),
                u.isActive(), u.isMustChangePassword(), u.isLocked(Instant.now()), u.getAvatarColor(), u.getPreferredLang(),
                u.getRoles().stream().sorted(UserService.roleOrder()).map(r -> new RoleRef(r.getCode(), r.getName(), r.getNameAr())).toList(),
                u.getLastLoginAt(), u.getCreatedAt());
    }
}

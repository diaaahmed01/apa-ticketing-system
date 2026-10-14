package com.apa.ats.permission;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import com.apa.ats.user.Role;
import com.apa.ats.user.RoleRepository;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PermissionMatrixService {

    /** The grant that keeps the Permissions Center reachable; it can never be revoked. */
    static final String LOCKOUT_PERMISSION = "ROLE_PERMISSION_MANAGE";

    private final RoleRepository roles;
    private final PermissionRepositories.Permissions permissions;
    private final PermissionRepositories.Grants grants;
    private final PermissionRepositories.Audits audits;

    public record RoleView(Long id, String code, String name, String nameAr, String description, boolean system, long activeUsers) {}
    public record PermissionView(String code, String category, String name, String description, List<String> allowedConditions) {}
    public record GrantView(String role, String permission, String condition) {}
    public record ConditionView(String code, String label) {}
    public record Matrix(List<RoleView> roles, List<PermissionView> permissions, List<GrantView> grants, List<ConditionView> conditions) {}

    public enum Action { GRANT, REVOKE }
    public record Change(String role, String permission, String condition, Action action) {}
    public record ChangeResult(String changeSetId, int applied, Matrix matrix) {}

    @Transactional(readOnly = true)
    public Matrix matrix() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : roles.activeUserCounts()) counts.put((Long) row[0], (Long) row[1]);

        List<Role> roleList = roles.findAllByOrderBySortOrderAsc();
        List<Permission> permList = permissions.findAllByOrderByCategoryAscSortOrderAsc();
        Map<Long, String> roleCode = roleList.stream().collect(Collectors.toMap(Role::getId, Role::getCode));
        Map<Long, String> permCode = permList.stream().collect(Collectors.toMap(Permission::getId, Permission::getCode));

        return new Matrix(
                roleList.stream().map(r -> new RoleView(r.getId(), r.getCode(), r.getName(), r.getNameAr(),
                        r.getDescription(), r.isSystem(), counts.getOrDefault(r.getId(), 0L))).toList(),
                permList.stream().map(p -> new PermissionView(p.getCode(), p.getCategory(), p.getName(),
                        p.getDescription(), p.allowedConditionList())).toList(),
                grants.findAll().stream()
                        .filter(g -> roleCode.containsKey(g.getRoleId()) && permCode.containsKey(g.getPermissionId()))
                        .map(g -> new GrantView(roleCode.get(g.getRoleId()), permCode.get(g.getPermissionId()), g.getConditionCode()))
                        .toList(),
                Arrays.stream(Condition.values()).map(c -> new ConditionView(c.name(), c.label())).toList());
    }

    /** Applies a batch of grant/revoke changes atomically and records them under one change-set id. */
    @Transactional
    public ChangeResult apply(List<Change> changes) {
        if (changes == null || changes.isEmpty()) throw ApiException.badRequest("NO_CHANGES", "There are no changes to save.");
        CurrentUser me = CurrentUser.require();
        Map<String, Role> roleByCode = roles.findAll().stream().collect(Collectors.toMap(Role::getCode, Function.identity()));
        Map<String, Permission> permByCode = permissions.findAll().stream().collect(Collectors.toMap(Permission::getCode, Function.identity()));

        String changeSet = UUID.randomUUID().toString();
        Instant now = Instant.now();
        int applied = 0;

        for (Change c : changes) {
            Role role = roleByCode.get(c.role());
            Permission perm = permByCode.get(c.permission());
            if (role == null) throw ApiException.badRequest("UNKNOWN_ROLE", "Unknown role: " + c.role());
            if (perm == null) throw ApiException.badRequest("UNKNOWN_PERMISSION", "Unknown permission: " + c.permission());
            if (c.action() == null) throw ApiException.badRequest("BAD_ACTION", "Each change needs an action: GRANT or REVOKE.");
            String cond = c.condition() == null ? Condition.ALWAYS.name() : c.condition();
            validateCondition(perm, cond);

            if (c.action() == Action.REVOKE && Role.SYS_ADMIN.equals(role.getCode())
                    && LOCKOUT_PERMISSION.equals(perm.getCode()) && Condition.ALWAYS.name().equals(cond)) {
                throw ApiException.conflict("LOCKOUT_PROTECTED",
                        "System Administrator must keep \"Manage roles and permissions\", otherwise nobody could change permissions again.");
            }

            RolePermission.Key key = new RolePermission.Key(role.getId(), perm.getId(), cond);
            boolean exists = grants.existsById(key);
            if (c.action() == Action.GRANT && !exists) {
                RolePermission g = new RolePermission();
                g.setRoleId(role.getId());
                g.setPermissionId(perm.getId());
                g.setConditionCode(cond);
                g.setGrantedAt(now);
                g.setGrantedBy(me.id());
                grants.save(g);
            } else if (c.action() == Action.REVOKE && exists) {
                grants.deleteById(key);
            } else {
                continue; // already in the requested state
            }
            PermissionAudit a = new PermissionAudit();
            a.setChangeSetId(changeSet);
            a.setRoleId(role.getId());
            a.setPermissionId(perm.getId());
            a.setConditionCode(cond);
            a.setAction(c.action().name());
            a.setChangedBy(me.id());
            a.setChangedAt(now);
            audits.save(a);
            applied++;
        }
        grants.flush();
        return new ChangeResult(changeSet, applied, matrix());
    }

    private static void validateCondition(Permission perm, String cond) {
        Condition parsed;
        try {
            parsed = Condition.valueOf(cond);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("UNKNOWN_CONDITION", "Unknown condition: " + cond);
        }
        if (parsed != Condition.ALWAYS && !perm.allowedConditionList().contains(parsed.name())) {
            throw ApiException.badRequest("CONDITION_NOT_ALLOWED",
                    "\"" + perm.getName() + "\" can't be granted with the condition \"" + parsed.label() + "\".");
        }
    }
}

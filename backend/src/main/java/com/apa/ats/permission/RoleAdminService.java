package com.apa.ats.permission;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import com.apa.ats.permission.PermissionMatrixService.RoleView;
import com.apa.ats.user.Role;
import com.apa.ats.user.RoleRepository;
import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates, renames and deletes roles. System roles can be renamed but never deleted, and their code never changes. */
@Service
@RequiredArgsConstructor
public class RoleAdminService {

    private static final int CODE_MAX = 40;

    private final RoleRepository roles;
    private final PermissionRepositories.Grants grants;
    private final PermissionRepositories.Audits audits;

    public record RoleInput(String name, String nameAr, String description) {}

    @Transactional
    public RoleView create(RoleInput in) {
        String name = name(in.name());
        ensureNameFree(name, null);
        Role r = new Role();
        r.setCode(uniqueCode(name));
        r.setName(name);
        r.setNameAr(blankToNull(in.nameAr(), 80, "Arabic name"));
        r.setDescription(blankToNull(in.description(), 400, "Description"));
        r.setSystem(false);
        r.setSortOrder(roles.findAll().stream().mapToInt(Role::getSortOrder).max().orElse(0) + 10);
        r.setCreatedAt(Instant.now());
        return view(roles.save(r));
    }

    @Transactional
    public RoleView update(Long id, RoleInput in) {
        Role r = roles.findById(id).orElseThrow(() -> ApiException.notFound("Role"));
        String name = name(in.name());
        ensureNameFree(name, id);
        r.setName(name);
        r.setNameAr(blankToNull(in.nameAr(), 80, "Arabic name"));
        r.setDescription(blankToNull(in.description(), 400, "Description"));
        return view(r);
    }

    @Transactional
    public void delete(Long id) {
        Role r = roles.findById(id).orElseThrow(() -> ApiException.notFound("Role"));
        if (r.isSystem()) {
            throw ApiException.conflict("ROLE_IS_SYSTEM", "\"" + r.getName() + "\" is a built-in role and can't be deleted.");
        }
        long users = roles.userCount(id);
        if (users > 0) {
            throw ApiException.conflict("ROLE_IN_USE", "\"" + r.getName() + "\" is still assigned to " + users
                    + (users == 1 ? " user" : " users") + ". Move them to another role first.");
        }
        // Record every grant the role held as a revoke, under one change set, before the grants go.
        CurrentUser me = CurrentUser.require();
        String changeSet = UUID.randomUUID().toString();
        Instant now = Instant.now();
        for (RolePermission g : grants.findAll()) {
            if (!id.equals(g.getRoleId())) continue;
            PermissionAudit a = new PermissionAudit();
            a.setChangeSetId(changeSet);
            a.setRoleId(id);
            a.setPermissionId(g.getPermissionId());
            a.setConditionCode(g.getConditionCode());
            a.setAction("REVOKE");
            a.setChangedBy(me.id());
            a.setChangedAt(now);
            audits.save(a);
        }
        grants.deleteByRoleId(id);
        roles.delete(r);
        roles.flush();
    }

    private RoleView view(Role r) {
        return new RoleView(r.getId(), r.getCode(), r.getName(), r.getNameAr(), r.getDescription(), r.isSystem(),
                roles.userCount(r.getId()));
    }

    private static String name(String v) {
        if (v == null || v.isBlank()) throw ApiException.badRequest("REQUIRED", "Role name is required.");
        String n = v.strip();
        if (n.length() > 80) throw ApiException.badRequest("BAD_NAME", "Role name is too long (80 characters max).");
        return n;
    }

    private static String blankToNull(String v, int max, String field) {
        if (v == null || v.isBlank()) return null;
        String n = v.strip();
        if (n.length() > max) throw ApiException.badRequest("TOO_LONG", field + " is too long (" + max + " characters max).");
        return n;
    }

    private void ensureNameFree(String name, Long selfId) {
        for (Role other : roles.findAll()) {
            if (!other.getId().equals(selfId) && other.getName().equalsIgnoreCase(name)) {
                throw ApiException.conflict("ROLE_EXISTS", "A role called \"" + other.getName() + "\" already exists.");
            }
        }
    }

    /** NAME → UPPER_SNAKE (A–Z, 0–9, underscores), unique, at most 40 characters. */
    private String uniqueCode(String name) {
        String base = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (base.isEmpty()) base = "ROLE";
        if (base.length() > CODE_MAX) base = base.substring(0, CODE_MAX).replaceAll("_+$", "");
        List<String> taken = roles.findAll().stream().map(Role::getCode).toList();
        String code = base;
        for (int i = 2; taken.contains(code); i++) {
            String suffix = "_" + i;
            String head = base.length() + suffix.length() > CODE_MAX ? base.substring(0, CODE_MAX - suffix.length()) : base;
            code = head + suffix;
        }
        return code;
    }
}

package com.apa.ats.permission;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Answers "may this user do X?" from the configurable grants in ATS_ROLE_PERMISSIONS.
 *
 * <p>This only covers permissions. Workflow invariants — the reviewer and tester must be
 * independent of code contributors, rejections need a reason, and so on — live in the
 * workflow service and apply on top of this, whatever the grants say.
 */
@Service
@RequiredArgsConstructor
public class AccessGuard {

    private final PermissionRepositories.Grants grants;

    /** Permission code → granted condition codes, for the given user. */
    public Map<String, Set<String>> grantsOf(CurrentUser user) {
        Map<String, Set<String>> out = new HashMap<>();
        if (user.roleIds().isEmpty()) return out;
        for (Object[] row : grants.codesForRoles(user.roleIds())) {
            out.computeIfAbsent((String) row[0], k -> new HashSet<>()).add((String) row[1]);
        }
        return out;
    }

    /** True when the user holds the permission unconditionally. */
    public boolean has(CurrentUser user, String permission) {
        return allows(user, permission, Set.of());
    }

    /**
     * True when the user holds the permission unconditionally, or under a condition that
     * matches one of their relationships to the target (e.g. TICKET_CREATOR, COLLABORATOR).
     */
    public boolean allows(CurrentUser user, String permission, Collection<Condition> relationships) {
        Set<String> conditions = grantsOf(user).get(permission);
        if (conditions == null) return false;
        if (conditions.contains(Condition.ALWAYS.name())) return true;
        return relationships.stream().anyMatch(r -> conditions.contains(r.name()));
    }

    public void require(String permission) {
        if (!has(CurrentUser.require(), permission)) {
            throw ApiException.forbidden("You don't have permission to do this.");
        }
    }

    public void require(String permission, Collection<Condition> relationships) {
        if (!allows(CurrentUser.require(), permission, relationships)) {
            throw ApiException.forbidden("You don't have permission to do this.");
        }
    }
}

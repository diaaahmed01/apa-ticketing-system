package com.apa.ats.auth;

import com.apa.ats.common.ApiException;
import com.apa.ats.user.AtsUser;
import com.apa.ats.user.Role;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** The authenticated ATS user for the current request, rebuilt from the database on every request. */
public record CurrentUser(
        Long id,
        String username,
        String fullName,
        Set<Long> roleIds,
        Set<String> roleCodes,
        boolean mustChangePassword) {

    public static CurrentUser of(AtsUser u) {
        return new CurrentUser(
                u.getId(),
                u.getUsername(),
                u.getFullName(),
                u.getRoles().stream().map(Role::getId).collect(Collectors.toUnmodifiableSet()),
                u.getRoles().stream().map(Role::getCode).collect(Collectors.toUnmodifiableSet()),
                u.isMustChangePassword());
    }

    public static CurrentUser require() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CurrentUser cu) return cu;
        throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Sign in to continue.");
    }
}

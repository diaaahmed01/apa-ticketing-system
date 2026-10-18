package com.apa.ats.permission;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public final class PermissionRepositories {

    private PermissionRepositories() {}

    public interface Permissions extends JpaRepository<Permission, Long> {
        Optional<Permission> findByCode(String code);

        List<Permission> findAllByOrderByCategoryAscSortOrderAsc();
    }

    public interface Grants extends JpaRepository<RolePermission, RolePermission.Key> {
        /** (permission code, condition code) pairs granted to any of the given roles. */
        @Query("select p.code, g.conditionCode from RolePermission g, Permission p "
                + "where g.permissionId = p.id and g.roleId in ?1")
        List<Object[]> codesForRoles(Collection<Long> roleIds);

        @Modifying
        @Query("delete from RolePermission g where g.roleId = ?1")
        int deleteByRoleId(Long roleId);
    }

    public interface Audits extends JpaRepository<PermissionAudit, Long> {}
}

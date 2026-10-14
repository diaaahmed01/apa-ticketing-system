package com.apa.ats.permission;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "ATS_ROLE_PERMISSIONS")
@IdClass(RolePermission.Key.class)
public class RolePermission {

    @Id private Long roleId;
    @Id private Long permissionId;
    @Id private String conditionCode;

    private Instant grantedAt;
    private Long grantedBy;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private Long roleId;
        private Long permissionId;
        private String conditionCode;
    }
}

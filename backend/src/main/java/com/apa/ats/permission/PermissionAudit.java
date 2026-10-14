package com.apa.ats.permission;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "ATS_PERMISSION_AUDIT")
public class PermissionAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_perm_audit_seq")
    @SequenceGenerator(name = "ats_perm_audit_seq", sequenceName = "ATS_PERMISSION_AUDIT_SEQ", allocationSize = 1)
    private Long id;

    private String changeSetId;
    private Long roleId;
    private Long permissionId;
    private String conditionCode;
    private String action;
    private Long changedBy;
    private Instant changedAt;
}

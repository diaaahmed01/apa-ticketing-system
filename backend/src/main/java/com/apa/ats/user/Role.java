package com.apa.ats.user;

import jakarta.persistence.Column;
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
@Table(name = "ATS_ROLES")
public class Role {

    public static final String SYS_ADMIN = "SYS_ADMIN";

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_roles_seq")
    @SequenceGenerator(name = "ats_roles_seq", sequenceName = "ATS_ROLES_SEQ", allocationSize = 1)
    private Long id;

    private String code;
    private String name;
    private String nameAr;
    private String description;

    @Column(name = "IS_SYSTEM")
    private boolean system;

    private int sortOrder;
    private Instant createdAt;
}

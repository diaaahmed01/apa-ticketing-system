package com.apa.ats.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;

/** An ATS account. Entirely separate from Orbit's users. */
@Getter
@Setter
@Entity
@Table(name = "ATS_USERS")
public class AtsUser {

    public enum Organization { PORT, VENDOR }

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_users_seq")
    @SequenceGenerator(name = "ats_users_seq", sequenceName = "ATS_USERS_SEQ", allocationSize = 1)
    private Long id;

    private String username;
    private String fullName;
    private String email;

    @Enumerated(EnumType.STRING)
    private Organization organization;

    private String passwordHash;
    private boolean mustChangePassword;
    private Instant passwordChangedAt;

    @Column(name = "IS_ACTIVE")
    private boolean active;

    private int failedLogins;
    private Instant lockedUntil;
    private Instant lastLoginAt;
    private String avatarColor;
    private String preferredLang;

    private Instant createdAt;
    private Long createdBy;
    private Instant updatedAt;
    private Long updatedBy;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "ATS_USER_ROLES",
            joinColumns = @JoinColumn(name = "USER_ID"),
            inverseJoinColumns = @JoinColumn(name = "ROLE_ID"))
    private Set<Role> roles = new LinkedHashSet<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (passwordChangedAt == null) passwordChangedAt = now;
        if (preferredLang == null) preferredLang = "en";
    }

    public boolean hasRole(String code) {
        return roles.stream().anyMatch(r -> r.getCode().equals(code));
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }
}

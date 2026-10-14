package com.apa.ats.module;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "ATS_MODULES")
public class AtsModule {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_modules_seq")
    @SequenceGenerator(name = "ats_modules_seq", sequenceName = "ATS_MODULES_SEQ", allocationSize = 1)
    private Long id;

    private String name;
    private String nameAr;

    @Column(name = "IS_ACTIVE")
    private boolean active;

    private int sortOrder;
    private Instant createdAt;
    private Long createdBy;
    private Instant updatedAt;
    private Long updatedBy;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

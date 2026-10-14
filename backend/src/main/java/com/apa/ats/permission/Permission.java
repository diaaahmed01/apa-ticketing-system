package com.apa.ats.permission;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Arrays;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** One action in the permission catalog. Rows are seeded by migrations, never created at runtime. */
@Getter
@Setter
@Entity
@Table(name = "ATS_PERMISSIONS")
public class Permission {

    @Id
    private Long id;
    private String code;
    private String category;
    private String name;
    private String description;
    /** Comma-separated condition codes this permission may be granted under, besides ALWAYS. */
    private String allowedConditions;
    private int sortOrder;

    public List<String> allowedConditionList() {
        if (allowedConditions == null || allowedConditions.isBlank()) return List.of();
        return Arrays.stream(allowedConditions.split(",")).map(String::strip).toList();
    }
}

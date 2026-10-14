package com.apa.ats.ticket;

import com.apa.ats.ticket.TicketEnums.PersonKind;
import com.apa.ats.ticket.TicketRecords.TicketPerson;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/** Ticket list filtering and sorting, built as one JPA Specification. */
public final class TicketSearch {

    private TicketSearch() {}

    public enum Sort { NEWEST, OLDEST, PRIORITY, UPDATED }

    /**
     * All list filters are optional; within one filter values are OR-ed, across filters AND-ed.
     * {@code assignee} may contain 0 for "unassigned". {@code mine} = assigned, created, reviewing,
     * testing or collaborating.
     */
    public record Filter(String q, List<String> status, List<String> priority, List<Long> module,
                         List<Long> assignee, List<String> environment, List<String> type, List<Long> creator,
                         List<Long> reviewer, List<Long> tester, List<String> closure, Boolean hasPatch,
                         boolean mine, LocalDate createdFrom, LocalDate createdTo, Sort sort) {}

    static Specification<Ticket> spec(Filter f, Long me) {
        return (root, query, cb) -> {
            List<Predicate> and = new ArrayList<>();

            if (f.q() != null && !f.q().isBlank()) {
                String raw = f.q().strip();
                String digits = raw.replaceFirst("(?i)^#?\\s*(tkt-?)?\\s*", "");
                String like = "%" + raw.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                List<Predicate> or = new ArrayList<>();
                if (digits.matches("\\d{1,12}")) or.add(cb.equal(root.get("id"), Long.parseLong(digits)));
                // Oracle's NLS_LOWER, called directly: Hibernate's lower() refuses the NCLOB
                // description, and NLS_LOWER also handles NVARCHAR2/NCLOB text in any script.
                or.add(cb.like(cb.function("NLS_LOWER", String.class, root.get("title")), like, '\\'));
                or.add(cb.like(cb.function("NLS_LOWER", String.class, root.get("description")), like, '\\'));
                and.add(cb.or(or.toArray(Predicate[]::new)));
            }

            in(and, root.get("status").as(String.class), f.status());
            in(and, root.get("priority").as(String.class), f.priority());
            in(and, root.get("environment").as(String.class), f.environment());
            in(and, root.get("type").as(String.class), f.type());
            in(and, root.get("closureStatus").as(String.class), f.closure());
            in(and, root.get("moduleId"), f.module());
            in(and, root.get("createdBy"), f.creator());
            in(and, root.get("reviewerId"), f.reviewer());
            in(and, root.get("testerId"), f.tester());

            if (f.assignee() != null && !f.assignee().isEmpty()) {
                List<Long> real = f.assignee().stream().filter(id -> id != 0).toList();
                List<Predicate> or = new ArrayList<>();
                if (!real.isEmpty()) or.add(root.get("assigneeId").in(real));
                if (f.assignee().contains(0L)) or.add(cb.isNull(root.get("assigneeId")));
                and.add(cb.or(or.toArray(Predicate[]::new)));
            }

            if (Boolean.TRUE.equals(f.hasPatch())) and.add(cb.isNotNull(root.get("patchReference")));

            ZoneId zone = ZoneId.systemDefault();
            if (f.createdFrom() != null) {
                and.add(cb.greaterThanOrEqualTo(root.get("createdAt"), f.createdFrom().atStartOfDay(zone).toInstant()));
            }
            if (f.createdTo() != null) {
                Instant end = f.createdTo().plusDays(1).atStartOfDay(zone).toInstant();
                and.add(cb.lessThan(root.get("createdAt"), end));
            }

            if (f.mine()) {
                Subquery<Long> collab = query.subquery(Long.class);
                Root<TicketPerson> p = collab.from(TicketPerson.class);
                collab.select(p.get("ticketId")).where(
                        cb.equal(p.get("userId"), me),
                        cb.equal(p.get("kind"), PersonKind.COLLABORATOR));
                and.add(cb.or(
                        cb.equal(root.get("assigneeId"), me),
                        cb.equal(root.get("createdBy"), me),
                        cb.equal(root.get("reviewerId"), me),
                        cb.equal(root.get("testerId"), me),
                        root.get("id").in(collab)));
            }

            // Sorting only applies to the data query, not Spring's count query.
            if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                Sort sort = f.sort() == null ? Sort.NEWEST : f.sort();
                switch (sort) {
                    case OLDEST -> query.orderBy(cb.asc(root.get("createdAt")), cb.asc(root.get("id")));
                    case UPDATED -> query.orderBy(cb.desc(cb.coalesce(root.get("updatedAt"), root.get("createdAt"))), cb.desc(root.get("id")));
                    case PRIORITY -> {
                        Expression<Integer> rank = cb.<Integer>selectCase()
                                .when(cb.equal(root.get("priority"), TicketEnums.Priority.CRITICAL), 0)
                                .when(cb.equal(root.get("priority"), TicketEnums.Priority.HIGH), 1)
                                .when(cb.equal(root.get("priority"), TicketEnums.Priority.MEDIUM), 2)
                                .otherwise(3);
                        query.orderBy(cb.asc(rank), cb.desc(root.get("createdAt")));
                    }
                    default -> query.orderBy(cb.desc(root.get("createdAt")), cb.desc(root.get("id")));
                }
            }
            return cb.and(and.toArray(Predicate[]::new));
        };
    }

    private static <T> void in(List<Predicate> and, Expression<T> path, List<T> values) {
        if (values != null && !values.isEmpty()) and.add(path.in(values));
    }
}

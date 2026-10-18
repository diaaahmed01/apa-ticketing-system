package com.apa.ats.dashboard;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ReferenceCache;
import com.apa.ats.ticket.Ticket;
import com.apa.ats.ticket.TicketEnums.Closure;
import com.apa.ats.ticket.TicketEnums.Environment;
import com.apa.ats.ticket.TicketEnums.Priority;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketEnums.Type;
import com.apa.ats.ticket.TicketRecords.TicketActivity;
import com.apa.ats.ticket.TicketViews;
import com.apa.ats.ticket.TicketViews.Card;
import com.apa.ats.ticket.TicketViews.Lookup;
import com.apa.ats.ticket.TicketViews.ModuleRef;
import com.apa.ats.ticket.TicketViews.PersonRef;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dashboard numbers. Six grouped or light queries in total (open counts, created times, closed rows,
 * review/test/verify activity counts, the caller's queue, the newest tickets); users and modules come from the cache.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final Set<Integer> PERIODS = Set.of(30, 90, 180, 365);
    private static final int QUEUE_LIMIT = 10;
    private static final int ASSIGNEE_LIMIT = 8;
    private static final int RECENT_LIMIT = 6;

    @PersistenceContext
    private EntityManager em;

    private final ReferenceCache cache;

    public record ModuleCount(ModuleRef module, long count) {}
    public record AssigneeCount(PersonRef person, long count) {}
    public record Closed(long resolved, long unresolved, long cancelled, long total) {}

    public record Totals(long open, Map<String, Long> byStatus, Closed closedInPeriod, long createdInPeriod,
                         long criticalOpen, long unassignedOpen, long blocked) {}

    public record WeekBucket(String weekStart, long created, long closed) {}

    /** {@code bad} of {@code bad + good} outcomes; rate is null when there were none. */
    public record Rate(long bad, long good, Double rate) {}
    public record Quality(Rate reviewRejection, Rate testFailure, Rate verificationFailure) {}

    public record Cycle(Double medianDays, Double averageDays, long count) {}

    public record QueueItem(Card ticket, String reason) {}

    public record Assignees(List<AssigneeCount> top, long unassigned) {}

    /** Headline cards: total = created in the period, closed = closed in the period, the rest are current counts. */
    public record Kpis(long total, long open, long inProgress, long testing, long blocked, long closed) {}

    public record Dashboard(int days, Long module, Environment environment, Priority priority, Instant from,
                            Kpis kpis, Totals totals, Map<String, Long> byPriority,
                            List<ModuleCount> byModule, Map<String, Long> byType, Map<String, Long> byEnvironment,
                            List<WeekBucket> trend, Quality quality, Cycle cycle, List<QueueItem> myQueue,
                            Assignees byAssignee, List<Card> recent, Instant generatedAt) {}

    @Transactional(readOnly = true)
    public Dashboard build(Long moduleId, Environment env, Priority prio, int daysParam) {
        int days = PERIODS.contains(daysParam) ? daysParam : 90;
        Instant now = Instant.now();
        Instant from = now.minusSeconds(days * 86_400L);
        ZoneId zone = ZoneId.systemDefault();
        CurrentUser me = CurrentUser.require();
        ReferenceCache.Snapshot snap = cache.get();
        Lookup lookup = new Lookup(snap.users(), snap.modules());

        // 1. Open tickets, grouped on every dimension the breakdowns need; rolled up here.
        List<Object[]> openRows = bind(em.createQuery(
                "select t.status, t.priority, t.moduleId, t.type, t.environment, t.assigneeId, count(t) from Ticket t "
                        + "where t.status <> :closed" + filt(moduleId, env, prio) + " "
                        + "group by t.status, t.priority, t.moduleId, t.type, t.environment, t.assigneeId", Object[].class)
                .setParameter("closed", Status.CLOSED), moduleId, env, prio).getResultList();

        Map<Status, Long> byStatus = new EnumMap<>(Status.class);
        Map<Priority, Long> byPriority = new EnumMap<>(Priority.class);
        Map<Type, Long> byType = new EnumMap<>(Type.class);
        Map<Environment, Long> byEnv = new EnumMap<>(Environment.class);
        Map<Long, Long> byModule = new HashMap<>();
        Map<Long, Long> byAssignee = new HashMap<>();
        for (Status s : Status.values()) if (s != Status.CLOSED) byStatus.put(s, 0L);
        for (Priority p : Priority.values()) byPriority.put(p, 0L);
        for (Type t : Type.values()) byType.put(t, 0L);
        for (Environment e : Environment.values()) byEnv.put(e, 0L);
        long open = 0, unassigned = 0;
        for (Object[] r : openRows) {
            long n = (Long) r[6];
            open += n;
            byStatus.merge((Status) r[0], n, Long::sum);
            byPriority.merge((Priority) r[1], n, Long::sum);
            byModule.merge((Long) r[2], n, Long::sum);
            byType.merge((Type) r[3], n, Long::sum);
            byEnv.merge((Environment) r[4], n, Long::sum);
            if (r[5] == null) unassigned += n; else byAssignee.merge((Long) r[5], n, Long::sum);
        }

        // 2. Creation times in the period (weekly buckets and the created count).
        List<Instant> created = bind(em.createQuery(
                "select t.createdAt from Ticket t where t.createdAt >= :from" + filt(moduleId, env, prio),
                Instant.class).setParameter("from", from), moduleId, env, prio).getResultList();

        // 3. Tickets closed in the period: closure, created and closed times.
        List<Object[]> closedRows = bind(em.createQuery(
                "select t.closureStatus, t.createdAt, t.closedAt from Ticket t where t.status = :closed "
                        + "and t.closedAt >= :from" + filt(moduleId, env, prio), Object[].class)
                .setParameter("closed", Status.CLOSED).setParameter("from", from), moduleId, env, prio).getResultList();
        long resolved = 0, unresolved = 0, cancelled = 0;
        List<Double> cycleDays = new ArrayList<>();
        List<Instant> closedAt = new ArrayList<>();
        for (Object[] r : closedRows) {
            Closure c = (Closure) r[0];
            Instant createdAt = (Instant) r[1], closed = (Instant) r[2];
            closedAt.add(closed);
            if (c == Closure.RESOLVED) {
                resolved++;
                if (createdAt != null) cycleDays.add((closed.toEpochMilli() - createdAt.toEpochMilli()) / 86_400_000.0);
            } else if (c == Closure.UNRESOLVED) {
                unresolved++;
            } else {
                cancelled++;
            }
        }

        // 4. Workflow outcomes from the activity log.
        Map<String, Long> actions = activityCounts(from, moduleId, env, prio);
        Quality quality = new Quality(
                rate(actions, "REVIEW_REJECTED", "REVIEW_APPROVED"),
                rate(actions, "TEST_FAILED", "TEST_PASSED"),
                rate(actions, "VERIFICATION_FAILED", "VERIFIED"));

        // 5. The caller's own queue (not narrowed by the module filter: it is what is waiting on them).
        List<QueueItem> queue = queue(me.id(), lookup);

        // 6. The newest tickets matching the filters, as cards.
        List<Card> recent = bind(em.createQuery("select t from Ticket t where 1 = 1" + filt(moduleId, env, prio)
                + " order by t.createdAt desc, t.id desc", Ticket.class), moduleId, env, prio)
                .setMaxResults(RECENT_LIMIT).getResultList().stream().map(t -> TicketViews.card(t, lookup)).toList();

        Kpis kpis = new Kpis(created.size(), byStatus.get(Status.OPEN), byStatus.get(Status.IN_PROGRESS),
                byStatus.get(Status.TESTING), byStatus.get(Status.BLOCKED), closedRows.size());

        Totals totals = new Totals(open, named(byStatus), new Closed(resolved, unresolved, cancelled, closedRows.size()),
                created.size(), byPriority.get(Priority.CRITICAL), unassigned, byStatus.get(Status.BLOCKED));

        List<ModuleCount> modules = byModule.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> new ModuleCount(lookup.module(e.getKey()), e.getValue())).toList();
        List<AssigneeCount> people = byAssignee.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(ASSIGNEE_LIMIT).map(e -> new AssigneeCount(lookup.person(e.getKey()), e.getValue())).toList();

        return new Dashboard(days, moduleId, env, prio, from, kpis, totals, named(byPriority), modules, named(byType), named(byEnv),
                trend(from, now, zone, created, closedAt), quality, cycle(cycleDays), queue,
                new Assignees(people, unassigned), recent, now);
    }

    /** Filters are added only when set: a null bind parameter has no reliable type on Oracle. */
    private static String filt(Long moduleId, Environment env, Priority prio) {
        return (moduleId == null ? "" : " and t.moduleId = :module")
                + (env == null ? "" : " and t.environment = :env")
                + (prio == null ? "" : " and t.priority = :prio");
    }

    private static <T> TypedQuery<T> bind(TypedQuery<T> q, Long moduleId, Environment env, Priority prio) {
        if (moduleId != null) q.setParameter("module", moduleId);
        if (env != null) q.setParameter("env", env);
        if (prio != null) q.setParameter("prio", prio);
        return q;
    }

    private static <K extends Enum<K>> Map<String, Long> named(Map<K, Long> m) {
        Map<String, Long> out = new LinkedHashMap<>();
        m.forEach((k, v) -> out.put(k.name(), v));
        return out;
    }

    private Map<String, Long> activityCounts(Instant from, Long moduleId, Environment env, Priority prio) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> q = cb.createTupleQuery();
        Root<TicketActivity> a = q.from(TicketActivity.class);
        List<Predicate> where = new ArrayList<>();
        where.add(a.get("action").in("REVIEW_APPROVED", "REVIEW_REJECTED", "TEST_PASSED", "TEST_FAILED", "VERIFIED", "VERIFICATION_FAILED"));
        where.add(cb.greaterThanOrEqualTo(a.<Instant>get("createdAt"), from));
        if (moduleId != null || env != null || prio != null) {
            Root<Ticket> t = q.from(Ticket.class);
            where.add(cb.equal(t.get("id"), a.get("ticketId")));
            if (moduleId != null) where.add(cb.equal(t.get("moduleId"), moduleId));
            if (env != null) where.add(cb.equal(t.get("environment"), env));
            if (prio != null) where.add(cb.equal(t.get("priority"), prio));
        }
        q.multiselect(a.get("action").alias("action"), cb.count(a).alias("n"))
                .where(where.toArray(Predicate[]::new)).groupBy(a.get("action"));
        Map<String, Long> out = new HashMap<>();
        for (Tuple r : em.createQuery(q).getResultList()) out.put(r.get("action", String.class), r.get("n", Long.class));
        return out;
    }

    private static Rate rate(Map<String, Long> m, String bad, String good) {
        long b = m.getOrDefault(bad, 0L), g = m.getOrDefault(good, 0L);
        return new Rate(b, g, b + g == 0 ? null : (double) b / (b + g));
    }

    private static Cycle cycle(List<Double> days) {
        if (days.isEmpty()) return new Cycle(null, null, 0);
        List<Double> s = days.stream().sorted().toList();
        int n = s.size();
        double median = n % 2 == 1 ? s.get(n / 2) : (s.get(n / 2 - 1) + s.get(n / 2)) / 2;
        double avg = s.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        return new Cycle(round1(median), round1(avg), n);
    }

    private static double round1(double v) { return Math.round(v * 10) / 10.0; }

    /** Weekly buckets (Monday start) from the week of {@code from} to the current week; empty weeks are zero. */
    private static List<WeekBucket> trend(Instant from, Instant now, ZoneId zone, List<Instant> created, List<Instant> closed) {
        LocalDate first = weekStart(from, zone), last = weekStart(now, zone);
        Map<LocalDate, long[]> weeks = new TreeMap<>();
        for (LocalDate d = first; !d.isAfter(last); d = d.plusWeeks(1)) weeks.put(d, new long[2]);
        for (Instant i : created) { long[] w = weeks.get(weekStart(i, zone)); if (w != null) w[0]++; }
        for (Instant i : closed) { long[] w = weeks.get(weekStart(i, zone)); if (w != null) w[1]++; }
        List<WeekBucket> out = new ArrayList<>();
        weeks.forEach((d, w) -> out.add(new WeekBucket(d.toString(), w[0], w[1])));
        return out;
    }

    private static LocalDate weekStart(Instant i, ZoneId zone) {
        return i.atZone(zone).toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private List<QueueItem> queue(Long me, Lookup lookup) {
        List<Ticket> mine = em.createQuery(
                "select t from Ticket t where (t.assigneeId = :me and t.status in (:work)) "
                        + "or (t.reviewerId = :me and t.status = :review) "
                        + "or (t.testerId = :me and t.status = :testing and (t.testResult is null or t.testResult <> 'PASSED')) "
                        + "or (t.createdBy = :me and t.status = :verify)", Ticket.class)
                .setParameter("me", me).setParameter("work", List.of(Status.OPEN, Status.IN_PROGRESS))
                .setParameter("review", Status.CODE_REVIEW).setParameter("testing", Status.TESTING)
                .setParameter("verify", Status.PRODUCTION_VERIFICATION).getResultList();
        return mine.stream()
                .sorted(Comparator.comparingInt((Ticket t) -> t.getPriority().rank())
                        .thenComparing(Ticket::getCreatedAt).thenComparing(Ticket::getId))
                .limit(QUEUE_LIMIT)
                .map(t -> new QueueItem(TicketViews.card(t, lookup), reason(t))).toList();
    }

    private static String reason(Ticket t) {
        return switch (t.getStatus()) {
            case CODE_REVIEW -> "Review the code";
            case TESTING -> "Test the fix";
            case PRODUCTION_VERIFICATION -> "Verify in production";
            case OPEN -> "Start work";
            default -> "Continue work";
        };
    }
}

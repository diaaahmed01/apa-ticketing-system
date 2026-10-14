package com.apa.ats.ticket;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import com.apa.ats.common.ReferenceCache;
import com.apa.ats.common.ReferenceCache.ModuleSnap;
import com.apa.ats.common.ReferenceCache.UserSnap;
import com.apa.ats.permission.AccessGuard;
import com.apa.ats.permission.Condition;
import com.apa.ats.ticket.TicketEnums.Environment;
import com.apa.ats.ticket.TicketEnums.LinkType;
import com.apa.ats.ticket.TicketEnums.PersonKind;
import com.apa.ats.ticket.TicketEnums.Priority;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketEnums.Type;
import com.apa.ats.ticket.TicketRecords.TicketActivity;
import com.apa.ats.ticket.TicketRecords.TicketLink;
import com.apa.ats.ticket.TicketRecords.TicketPerson;
import com.apa.ats.ticket.TicketViews.Abilities;
import com.apa.ats.ticket.TicketViews.ActivityView;
import com.apa.ats.ticket.TicketViews.Card;
import com.apa.ats.ticket.TicketViews.Detail;
import com.apa.ats.ticket.TicketViews.LinkView;
import com.apa.ats.ticket.TicketViews.Lookup;
import com.apa.ats.ticket.TicketViews.PageOf;
import com.apa.ats.ticket.TicketViews.PersonRef;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRecords.Tickets tickets;
    private final TicketRecords.People people;
    private final TicketRecords.Links links;
    private final TicketRecords.Activities activities;
    private final ReferenceCache cache;
    private final AccessGuard guard;

    /* ------------------------------------------------------------------ inputs */

    public record CreateInput(String title, String description, String type, String priority, Long moduleId,
                              String environment, Long assigneeId, Long reviewerId, Long testerId,
                              List<Long> collaboratorIds, String patchReference, List<Long> relatedTicketIds) {}

    /** Partial update: null fields are left unchanged. {@code version} must match (optimistic lock). */
    public record UpdateInput(Integer version, String title, String description, String type, String priority,
                              Long moduleId, String environment, String patchReference) {}

    /* ------------------------------------------------------------------ queries */

    @Transactional(readOnly = true)
    public PageOf<Card> search(TicketSearch.Filter f, int page, int size) {
        guard.require("TICKET_VIEW");
        int safeSize = Math.min(Math.max(size, 1), 100);
        Page<Ticket> result = tickets.findAll(TicketSearch.spec(f, CurrentUser.require().id()), PageRequest.of(Math.max(page, 0), safeSize));
        Lookup l = lookup();
        return new PageOf<>(result.getContent().stream().map(t -> TicketViews.card(t, l)).toList(),
                result.getTotalElements(), result.getNumber(), safeSize);
    }

    @Transactional(readOnly = true)
    public Detail detail(Long id) {
        guard.require("TICKET_VIEW");
        return toDetail(load(id), lookup());
    }

    /* ------------------------------------------------------------------ create */

    @Transactional
    public Detail create(CreateInput in) {
        guard.require("TICKET_CREATE");
        CurrentUser me = CurrentUser.require();
        Instant now = Instant.now();
        Lookup l = lookup();

        Ticket t = new Ticket();
        t.setTitle(title(in.title()));
        t.setDescription(description(in.description()));
        t.setType(parse(Type.class, in.type(), "type"));
        t.setPriority(parse(Priority.class, in.priority(), "priority"));
        t.setModuleId(activeModule(in.moduleId(), l).id());
        t.setEnvironment(parse(Environment.class, in.environment(), "environment"));
        t.setStatus(Status.OPEN);
        t.setPatchReference(patch(in.patchReference()));
        t.setCreatedBy(me.id());
        t.setCreatedAt(now);

        // The creator relationship is what conditional grants check at creation time.
        Set<Condition> rel = EnumSet.of(Condition.TICKET_CREATOR);
        if (in.assigneeId() != null) {
            guard.require("ASSIGN_TICKET", Set.of());
            t.setAssigneeId(activeUser(in.assigneeId(), l, "assignee").id());
            t.setAssignedBy(me.id());
            t.setAssignedAt(now);
            if (in.assigneeId().equals(me.id())) rel.add(Condition.CURRENT_ASSIGNEE);
        }
        if (in.reviewerId() != null) {
            guard.require("ASSIGN_REVIEWER", rel);
            t.setReviewerId(activeUser(in.reviewerId(), l, "reviewer").id());
        }
        if (in.testerId() != null) {
            guard.require("ASSIGN_TESTER", rel);
            t.setTesterId(activeUser(in.testerId(), l, "tester").id());
        }
        if (t.getReviewerId() != null && t.getReviewerId().equals(t.getTesterId())) {
            throw ApiException.badRequest("SAME_REVIEWER_TESTER", "Choose different people for reviewer and tester.");
        }
        t = tickets.saveAndFlush(t);

        log(t.getId(), me.id(), "CREATED", null, null, null, null);
        if (t.getAssigneeId() != null) log(t.getId(), me.id(), "ASSIGNEE_CHANGED", "assignee", null, l.name(t.getAssigneeId()), null);
        if (t.getReviewerId() != null) log(t.getId(), me.id(), "REVIEWER_CHANGED", "reviewer", null, l.name(t.getReviewerId()), null);
        if (t.getTesterId() != null) log(t.getId(), me.id(), "TESTER_CHANGED", "tester", null, l.name(t.getTesterId()), null);

        List<Long> collaborators = in.collaboratorIds() == null ? List.of() : in.collaboratorIds().stream().filter(Objects::nonNull).distinct().toList();
        if (!collaborators.isEmpty()) {
            guard.require("COLLAB_ADD", rel);
            for (Long uid : collaborators) {
                activeUser(uid, l, "collaborator");
                addPerson(t.getId(), uid, PersonKind.COLLABORATOR, me.id(), now);
                log(t.getId(), me.id(), "COLLABORATOR_ADDED", "collaborators", null, l.name(uid), null);
            }
        }
        if (in.relatedTicketIds() != null) {
            for (Long other : in.relatedTicketIds().stream().filter(Objects::nonNull).distinct().toList()) {
                linkRelated(t, other, me.id(), now);
            }
        }
        return toDetail(t, l);
    }

    /* ------------------------------------------------------------------ edits */

    @Transactional
    public Detail update(Long id, UpdateInput in) {
        Ticket t = loadOpen(id);
        checkVersion(t, in.version());
        CurrentUser me = CurrentUser.require();
        Set<Condition> rel = relationships(t, people.findByTicketId(id), me.id());
        Lookup l = lookup();
        List<String[]> changes = new ArrayList<>();

        boolean editsDetails = in.title() != null || in.description() != null || in.type() != null
                || in.moduleId() != null || in.environment() != null || in.patchReference() != null;
        if (editsDetails) guard.require("TICKET_EDIT", rel);

        if (in.title() != null && !title(in.title()).equals(t.getTitle())) {
            changes.add(new String[] {"title", t.getTitle(), title(in.title())});
            t.setTitle(title(in.title()));
        }
        if (in.description() != null && !description(in.description()).equals(t.getDescription())) {
            changes.add(new String[] {"description", null, null});
            t.setDescription(description(in.description()));
        }
        if (in.type() != null) {
            Type v = parse(Type.class, in.type(), "type");
            if (v != t.getType()) { changes.add(new String[] {"type", t.getType().name(), v.name()}); t.setType(v); }
        }
        if (in.moduleId() != null && !in.moduleId().equals(t.getModuleId())) {
            ModuleSnap m = activeModule(in.moduleId(), l);
            changes.add(new String[] {"module", l.module(t.getModuleId()).name(), m.name()});
            t.setModuleId(m.id());
        }
        if (in.environment() != null) {
            Environment v = parse(Environment.class, in.environment(), "environment");
            if (v != t.getEnvironment()) { changes.add(new String[] {"environment", t.getEnvironment().name(), v.name()}); t.setEnvironment(v); }
        }
        if (in.patchReference() != null && !Objects.equals(patch(in.patchReference()), t.getPatchReference())) {
            changes.add(new String[] {"patchReference", t.getPatchReference(), patch(in.patchReference())});
            t.setPatchReference(patch(in.patchReference()));
        }
        if (in.priority() != null) {
            Priority v = parse(Priority.class, in.priority(), "priority");
            if (v != t.getPriority()) {
                guard.require("TICKET_CHANGE_PRIORITY", rel);
                log(id, me.id(), "PRIORITY_CHANGED", "priority", t.getPriority().name(), v.name(), null);
                t.setPriority(v);
            }
        }
        for (String[] c : changes) log(id, me.id(), "FIELD_CHANGED", c[0], c[1], c[2], null);
        touch(t, me.id());
        return toDetail(t, l);
    }

    public enum Role { ASSIGNEE, REVIEWER, TESTER }

    /** Sets or clears (userId = null) the assignee, reviewer or tester. */
    @Transactional
    public Detail assign(Long id, Role role, Long userId, Integer version) {
        Ticket t = loadOpen(id);
        checkVersion(t, version);
        CurrentUser me = CurrentUser.require();
        List<TicketPerson> ps = people.findByTicketId(id);
        Set<Condition> rel = relationships(t, ps, me.id());
        Lookup l = lookup();
        if (userId != null) activeUser(userId, l, role.name().toLowerCase());
        Set<Long> contributors = ps.stream().filter(p -> p.getKind() == PersonKind.CONTRIBUTOR).map(TicketPerson::getUserId).collect(Collectors.toSet());

        Long before;
        switch (role) {
            case ASSIGNEE -> {
                guard.require("ASSIGN_TICKET", rel);
                before = t.getAssigneeId();
                t.setAssigneeId(userId);
                t.setAssignedBy(userId == null ? null : me.id());
                t.setAssignedAt(userId == null ? null : Instant.now());
            }
            case REVIEWER -> {
                guard.require("ASSIGN_REVIEWER", rel);
                // Workflow invariant, independent of any permission grant.
                if (userId != null && contributors.contains(userId)) {
                    throw ApiException.conflict("REVIEWER_NOT_INDEPENDENT", l.name(userId) + " contributed code to this ticket, so they can't review it.");
                }
                if (userId != null && userId.equals(t.getTesterId())) {
                    throw ApiException.badRequest("SAME_REVIEWER_TESTER", l.name(userId) + " is already the tester. Choose someone else to review.");
                }
                before = t.getReviewerId();
                t.setReviewerId(userId);
            }
            default -> {
                guard.require("ASSIGN_TESTER", rel);
                if (userId != null && contributors.contains(userId)) {
                    throw ApiException.conflict("TESTER_NOT_INDEPENDENT", l.name(userId) + " contributed code to this ticket, so they can't test it.");
                }
                if (userId != null && userId.equals(t.getReviewerId())) {
                    throw ApiException.badRequest("SAME_REVIEWER_TESTER", l.name(userId) + " is already the reviewer. Choose someone else to test.");
                }
                before = t.getTesterId();
                t.setTesterId(userId);
            }
        }
        if (!Objects.equals(before, userId)) {
            log(id, me.id(), role.name() + "_CHANGED", role.name().toLowerCase(), l.name(before), l.name(userId), null);
            touch(t, me.id());
        }
        return toDetail(t, l);
    }

    @Transactional
    public Detail addCollaborator(Long id, Long userId) {
        Ticket t = loadOpen(id);
        CurrentUser me = CurrentUser.require();
        List<TicketPerson> ps = people.findByTicketId(id);
        guard.require("COLLAB_ADD", relationships(t, ps, me.id()));
        Lookup l = lookup();
        activeUser(userId, l, "collaborator");
        if (people.existsById(new TicketPerson.Key(id, userId, PersonKind.COLLABORATOR))) return toDetail(t, l);
        addPerson(id, userId, PersonKind.COLLABORATOR, me.id(), Instant.now());
        log(id, me.id(), "COLLABORATOR_ADDED", "collaborators", null, l.name(userId), null);
        touch(t, me.id());
        return toDetail(t, l);
    }

    @Transactional
    public Detail removeCollaborator(Long id, Long userId) {
        Ticket t = loadOpen(id);
        CurrentUser me = CurrentUser.require();
        guard.require("COLLAB_REMOVE", relationships(t, people.findByTicketId(id), me.id()));
        TicketPerson.Key key = new TicketPerson.Key(id, userId, PersonKind.COLLABORATOR);
        Lookup l = lookup();
        if (people.existsById(key)) {
            people.deleteById(key);
            log(id, me.id(), "COLLABORATOR_REMOVED", "collaborators", l.name(userId), null, null);
            touch(t, me.id());
        }
        return toDetail(t, l);
    }

    @Transactional
    public Detail addRelated(Long id, Long otherId) {
        Ticket t = loadOpen(id);
        CurrentUser me = CurrentUser.require();
        guard.require("TICKET_EDIT", relationships(t, people.findByTicketId(id), me.id()));
        linkRelated(t, otherId, me.id(), Instant.now());
        touch(t, me.id());
        return toDetail(t, lookup());
    }

    @Transactional
    public Detail removeRelated(Long id, Long otherId) {
        Ticket t = loadOpen(id);
        CurrentUser me = CurrentUser.require();
        guard.require("TICKET_EDIT", relationships(t, people.findByTicketId(id), me.id()));
        boolean removed = false;
        for (TicketLink.Key k : List.of(new TicketLink.Key(id, otherId, LinkType.RELATED), new TicketLink.Key(otherId, id, LinkType.RELATED))) {
            if (links.existsById(k)) { links.deleteById(k); removed = true; }
        }
        if (removed) {
            log(id, me.id(), "LINK_REMOVED", "related", "TKT-" + otherId, null, null);
            log(otherId, me.id(), "LINK_REMOVED", "related", "TKT-" + id, null, null);
            touch(t, me.id());
        }
        return toDetail(t, lookup());
    }

    /* ------------------------------------------------------------------ helpers */

    /** The user's relationships to a ticket, matched against conditional grants. */
    static Set<Condition> relationships(Ticket t, Collection<TicketPerson> ps, Long userId) {
        Set<Condition> rel = EnumSet.noneOf(Condition.class);
        if (userId.equals(t.getCreatedBy())) rel.add(Condition.TICKET_CREATOR);
        if (userId.equals(t.getAssigneeId())) rel.add(Condition.CURRENT_ASSIGNEE);
        if (userId.equals(t.getReviewerId())) rel.add(Condition.ASSIGNED_REVIEWER);
        if (userId.equals(t.getTesterId())) rel.add(Condition.ASSIGNED_TESTER);
        if (ps.stream().anyMatch(p -> p.getKind() == PersonKind.COLLABORATOR && p.getUserId().equals(userId))) rel.add(Condition.COLLABORATOR);
        return rel;
    }

    private Detail toDetail(Ticket t, Lookup l) {
        CurrentUser me = CurrentUser.require();
        List<TicketPerson> ps = people.findByTicketId(t.getId());
        Set<Condition> rel = relationships(t, ps, me.id());
        boolean open = !t.isClosed();

        List<TicketLink> ls = links.findByFromTicketIdOrToTicketId(t.getId(), t.getId());
        Set<Long> otherIds = ls.stream().map(k -> k.getFromTicketId().equals(t.getId()) ? k.getToTicketId() : k.getFromTicketId()).collect(Collectors.toSet());
        Map<Long, Ticket> others = tickets.findAllById(otherIds).stream().collect(Collectors.toMap(Ticket::getId, Function.identity()));
        List<LinkView> linkViews = ls.stream().map(k -> {
            boolean outgoing = k.getFromTicketId().equals(t.getId());
            Ticket other = others.get(outgoing ? k.getToTicketId() : k.getFromTicketId());
            return other == null ? null : new LinkView(k.getLinkType().name(), outgoing ? "OUTGOING" : "INCOMING", TicketViews.card(other, l));
        }).filter(Objects::nonNull).toList();

        List<ActivityView> acts = activities.findTop300ByTicketIdOrderByCreatedAtDescIdDesc(t.getId()).stream()
                .map(a -> new ActivityView(a.getId(), l.person(a.getActorId()), a.getAction(), a.getField(),
                        a.getOldValue(), a.getNewValue(), a.getNote(), a.getCreatedAt()))
                .toList();

        Abilities can = new Abilities(
                open && guard.allows(me, "TICKET_EDIT", rel),
                open && guard.allows(me, "TICKET_CHANGE_PRIORITY", rel),
                open && guard.allows(me, "ASSIGN_TICKET", rel),
                open && guard.allows(me, "ASSIGN_REVIEWER", rel),
                open && guard.allows(me, "ASSIGN_TESTER", rel),
                open && guard.allows(me, "COLLAB_ADD", rel),
                open && guard.allows(me, "COLLAB_REMOVE", rel),
                open && guard.allows(me, "TICKET_EDIT", rel));

        return new Detail(t.getId(), t.getTitle(), t.getDescription(), t.getType().name(), t.getPriority().name(),
                t.getStatus().name(), t.getStatusBeforeBlock() == null ? null : t.getStatusBeforeBlock().name(),
                t.getClosureStatus() == null ? null : t.getClosureStatus().name(), t.getClosureReason(),
                l.module(t.getModuleId()), t.getEnvironment().name(), l.person(t.getCreatedBy()), t.getCreatedAt(),
                l.person(t.getAssigneeId()), l.person(t.getAssignedBy()), t.getAssignedAt(),
                l.person(t.getReviewerId()), l.person(t.getTesterId()),
                persons(ps, PersonKind.COLLABORATOR, l), persons(ps, PersonKind.CONTRIBUTOR, l),
                t.getPatchReference(), l.person(t.getClosedBy()), t.getClosedAt(), linkViews, acts,
                rel.stream().map(Enum::name).sorted().toList(), can, t.getVersion(), t.getUpdatedAt());
    }

    private static List<PersonRef> persons(List<TicketPerson> ps, PersonKind kind, Lookup l) {
        return ps.stream().filter(p -> p.getKind() == kind)
                .sorted((a, b) -> a.getAddedAt().compareTo(b.getAddedAt()))
                .map(p -> l.person(p.getUserId())).toList();
    }

    private void linkRelated(Ticket t, Long otherId, Long actor, Instant now) {
        if (otherId.equals(t.getId())) throw ApiException.badRequest("SELF_LINK", "A ticket can't be related to itself.");
        if (!tickets.existsById(otherId)) throw ApiException.badRequest("UNKNOWN_TICKET", "TKT-" + otherId + " doesn't exist.");
        if (links.existsById(new TicketLink.Key(t.getId(), otherId, LinkType.RELATED))
                || links.existsById(new TicketLink.Key(otherId, t.getId(), LinkType.RELATED))) return;
        TicketLink k = new TicketLink();
        k.setFromTicketId(t.getId());
        k.setToTicketId(otherId);
        k.setLinkType(LinkType.RELATED);
        k.setCreatedAt(now);
        k.setCreatedBy(actor);
        links.save(k);
        log(t.getId(), actor, "LINK_ADDED", "related", null, "TKT-" + otherId, null);
        log(otherId, actor, "LINK_ADDED", "related", null, "TKT-" + t.getId(), null);
    }

    private void addPerson(Long ticketId, Long userId, PersonKind kind, Long actor, Instant now) {
        TicketPerson p = new TicketPerson();
        p.setTicketId(ticketId);
        p.setUserId(userId);
        p.setKind(kind);
        p.setAddedAt(now);
        p.setAddedBy(actor);
        people.save(p);
    }

    void log(Long ticketId, Long actor, String action, String field, String oldValue, String newValue, String note) {
        TicketActivity a = new TicketActivity();
        a.setTicketId(ticketId);
        a.setActorId(actor);
        a.setAction(action);
        a.setField(field);
        a.setOldValue(clip(oldValue));
        a.setNewValue(clip(newValue));
        a.setNote(note);
        a.setCreatedAt(Instant.now());
        activities.save(a);
    }

    private Lookup lookup() {
        ReferenceCache.Snapshot s = cache.get();
        return new Lookup(s.users(), s.modules());
    }

    private Ticket load(Long id) {
        return tickets.findById(id).orElseThrow(() -> ApiException.notFound("TKT-" + id));
    }

    private Ticket loadOpen(Long id) {
        Ticket t = load(id);
        if (t.isClosed()) throw ApiException.conflict("TICKET_CLOSED", "TKT-" + id + " is closed and can no longer be changed.");
        return t;
    }

    private static void checkVersion(Ticket t, Integer version) {
        if (version != null && version != t.getVersion()) {
            throw new ObjectOptimisticLockingFailureException(Ticket.class, t.getId());
        }
    }

    private static void touch(Ticket t, Long actor) {
        t.setUpdatedAt(Instant.now());
        t.setUpdatedBy(actor);
    }

    private static ModuleSnap activeModule(Long id, Lookup l) {
        if (id == null) throw ApiException.badRequest("REQUIRED", "Choose a module.");
        ModuleSnap m = l.modules().get(id);
        if (m == null || !m.active()) throw ApiException.badRequest("BAD_MODULE", "That module isn't available. Pick another one.");
        return m;
    }

    private static UserSnap activeUser(Long id, Lookup l, String what) {
        UserSnap u = id == null ? null : l.users().get(id);
        if (u == null || !u.active()) throw ApiException.badRequest("BAD_USER", "The selected " + what + " isn't an active user.");
        return u;
    }

    private static String title(String v) {
        if (v == null || v.isBlank()) throw ApiException.badRequest("REQUIRED", "Give the ticket a title.");
        String s = v.strip().replaceAll("\\s+", " ");
        if (s.length() > 200) throw ApiException.badRequest("TOO_LONG", "Keep the title under 200 characters.");
        return s;
    }

    private static String description(String v) {
        if (v == null || v.isBlank()) throw ApiException.badRequest("REQUIRED", "Describe the issue: what happened and where.");
        String s = v.strip();
        if (s.length() > 20000) throw ApiException.badRequest("TOO_LONG", "The description is too long (20,000 characters max). Attach a file instead.");
        return s;
    }

    private static String patch(String v) {
        if (v == null || v.isBlank()) return null;
        String s = v.strip();
        if (s.length() > 100) throw ApiException.badRequest("TOO_LONG", "Patch reference is too long (100 characters max).");
        return s;
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String v, String field) {
        if (v == null || v.isBlank()) throw ApiException.badRequest("REQUIRED", "Choose a " + field + ".");
        try {
            return Enum.valueOf(type, v);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("BAD_VALUE", "Unknown " + field + ": " + v);
        }
    }

    private static String clip(String s) {
        return s == null || s.length() <= 400 ? s : s.substring(0, 399) + "…";
    }
}

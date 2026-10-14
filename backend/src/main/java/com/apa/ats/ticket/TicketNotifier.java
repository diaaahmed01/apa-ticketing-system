package com.apa.ats.ticket;

import com.apa.ats.notification.NotificationService;
import com.apa.ats.ticket.TicketEnums.Closure;
import com.apa.ats.ticket.TicketEnums.LinkType;
import com.apa.ats.ticket.TicketEnums.PersonKind;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketRecords.TicketLink;
import com.apa.ats.ticket.TicketRecords.TicketPerson;
import com.apa.ats.ticket.TicketViews.Lookup;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Turns ticket events into notifications: who hears about it, and the wording. The ticket services
 * call this inside their own transaction, so the notifications commit with the change.
 * Types: ASSIGNED, REVIEWER_ASSIGNED, TESTER_ASSIGNED, COLLABORATOR_ADDED, REVIEW_REQUESTED, REVIEW_APPROVED,
 * REVIEW_REJECTED, TEST_REQUESTED, TEST_PASSED, TEST_FAILED, STATUS_CHANGED, VERIFY_REQUESTED, BLOCKED,
 * UNBLOCKED, BLOCKER_CLOSED, COMMENT_ADDED, FOLLOW_UP_CREATED.
 */
@Component
@RequiredArgsConstructor
class TicketNotifier {

    private final NotificationService notes;
    private final TicketRecords.Tickets tickets;
    private final TicketRecords.Links links;
    private final TicketRecords.People people;

    /* ------------------------------------------------------------------ people */

    void assigned(Ticket t, Lookup l, Long actor, Long assigneeId) {
        if (assigneeId == null) return;
        notes.notify(t, "ASSIGNED", actor, List.of(assigneeId), who(l, actor) + " assigned " + no(t) + " to you", null);
    }

    void reviewerSet(Ticket t, Lookup l, Long actor, Long reviewerId) {
        if (reviewerId == null) return;
        notes.notify(t, "REVIEWER_ASSIGNED", actor, List.of(reviewerId), who(l, actor) + " made you the code reviewer of " + no(t), null);
    }

    void testerSet(Ticket t, Lookup l, Long actor, Long testerId) {
        if (testerId == null) return;
        notes.notify(t, "TESTER_ASSIGNED", actor, List.of(testerId), who(l, actor) + " made you the tester of " + no(t), null);
    }

    void collaboratorAdded(Ticket t, Lookup l, Long actor, Long userId) {
        notes.notify(t, "COLLABORATOR_ADDED", actor, List.of(userId), who(l, actor) + " added you as a collaborator on " + no(t), null);
    }

    /* ------------------------------------------------------------------ review and testing */

    void reviewRequested(Ticket t, Lookup l, Long actor) {
        if (t.getReviewerId() == null) return;
        notes.notify(t, "REVIEW_REQUESTED", actor, List.of(t.getReviewerId()), who(l, actor) + " submitted " + no(t) + " for code review", null);
    }

    void reviewApproved(Ticket t, Lookup l, Long actor, String note) {
        Set<Long> to = new LinkedHashSet<>();
        to.add(t.getAssigneeId());
        to.add(t.getTesterId());
        notes.notify(t, "REVIEW_APPROVED", actor, to, who(l, actor) + " approved the code review of " + no(t), note);
        testRequested(t, l, actor, note);
    }

    void reviewRejected(Ticket t, Lookup l, Long actor, String reason) {
        notes.notify(t, "REVIEW_REJECTED", actor, assigneeAndContributors(t), who(l, actor) + " rejected the code review of " + no(t), reason);
    }

    /** The ticket just entered TESTING: tell the tester. */
    void testRequested(Ticket t, Lookup l, Long actor, String note) {
        if (t.getTesterId() == null) return;
        notes.notify(t, "TEST_REQUESTED", actor, List.of(t.getTesterId()), no(t) + " is ready for testing", note);
    }

    void testPassed(Ticket t, Lookup l, Long actor, String note) {
        notes.notify(t, "TEST_PASSED", actor, notes.involved(t), who(l, actor) + " passed testing on " + no(t), note);
    }

    void testFailed(Ticket t, Lookup l, Long actor, String reason) {
        notes.notify(t, "TEST_FAILED", actor, assigneeAndContributors(t), who(l, actor) + " failed testing on " + no(t), reason);
    }

    /* ------------------------------------------------------------------ status */

    void statusChanged(Ticket t, Status to, Long actor, String body) {
        notes.notify(t, "STATUS_CHANGED", actor, notes.involved(t), no(t) + " moved to " + label(to), body);
    }

    /** Deployed and now awaiting production verification: the creator is asked to verify, everyone else is told. */
    void deployed(Ticket t, Long actor) {
        String patch = t.getPatchReference() == null ? null : "Patch: " + t.getPatchReference();
        Set<Long> others = new LinkedHashSet<>(notes.involved(t));
        if (t.getCreatedBy() != null) others.remove(t.getCreatedBy());
        notes.notify(t, "STATUS_CHANGED", actor, others, no(t) + " was deployed", patch);
        if (t.getCreatedBy() != null) {
            notes.notify(t, "VERIFY_REQUESTED", actor, List.of(t.getCreatedBy()), no(t) + " is deployed — please verify in production", patch);
        }
    }

    void closed(Ticket t, Lookup l, Long actor, Closure closure, String reason) {
        String title = switch (closure) {
            case RESOLVED -> who(l, actor) + " verified " + no(t) + " — closed as Resolved";
            case UNRESOLVED -> who(l, actor) + " closed " + no(t) + " as Unresolved";
            case CANCELLED -> who(l, actor) + " cancelled " + no(t);
        };
        notes.notify(t, "STATUS_CHANGED", actor, notes.involved(t), title, reason);
        blockerClosed(t, l, actor);
    }

    /** Production verification failed: the original is closed as Unresolved and {@code next} was opened. */
    void verificationFailed(Ticket t, Ticket next, Lookup l, Long actor, String reason) {
        Set<Long> involved = notes.involved(t);
        notes.notify(t, "STATUS_CHANGED", actor, involved,
                "Verification of " + no(t) + " failed — follow-up " + no(next) + " opened", reason);
        // Click-through goes to the new ticket.
        notes.notify(next, "FOLLOW_UP_CREATED", actor, involved, who(l, actor) + " opened follow-up " + no(next) + " for " + no(t), reason);
        blockerClosed(t, l, actor);
    }

    void blocked(Ticket t, Lookup l, Long actor, String reason) {
        notes.notify(t, "BLOCKED", actor, notes.involved(t), who(l, actor) + " blocked " + no(t), reason);
    }

    void unblocked(Ticket t, Lookup l, Long actor, String note) {
        notes.notify(t, "UNBLOCKED", actor, notes.involved(t), who(l, actor) + " unblocked " + no(t), note);
    }

    /** Tells the assignees of still-blocked tickets that were waiting for {@code closed}. Never unblocks anything. */
    private void blockerClosed(Ticket closed, Lookup l, Long actor) {
        List<Long> waitingIds = links.findByToTicketIdAndLinkType(closed.getId(), LinkType.BLOCKED_BY).stream()
                .map(TicketLink::getFromTicketId).distinct().toList();
        if (waitingIds.isEmpty()) return;
        for (Ticket waiting : tickets.findAllById(waitingIds)) {
            if (waiting.getStatus() != Status.BLOCKED || waiting.getAssigneeId() == null) continue;
            notes.notify(waiting, "BLOCKER_CLOSED", actor, List.of(waiting.getAssigneeId()),
                    no(closed) + " is closed — " + no(waiting) + " may be unblocked", null);
        }
    }

    /* ------------------------------------------------------------------ discussion */

    void commented(Ticket t, Lookup l, Long actor, String text) {
        String s = text == null ? "" : text.strip();
        String excerpt = s.length() > 200 ? s.substring(0, 200).strip() + "…" : s;
        notes.notify(t, "COMMENT_ADDED", actor, notes.involved(t), who(l, actor) + " commented on " + no(t), excerpt);
    }

    /* ------------------------------------------------------------------ helpers */

    private Set<Long> assigneeAndContributors(Ticket t) {
        Set<Long> out = new LinkedHashSet<>();
        if (t.getAssigneeId() != null) out.add(t.getAssigneeId());
        out.addAll(contributors(t.getId()));
        return out;
    }

    private Collection<Long> contributors(Long ticketId) {
        return people.findByTicketId(ticketId).stream()
                .filter(p -> p.getKind() == PersonKind.CONTRIBUTOR)
                .map(TicketPerson::getUserId)
                .collect(Collectors.toList());
    }

    static String no(Ticket t) {
        return "TKT-" + t.getId();
    }

    /** Full name, as in "Sara Hassan assigned TKT-12 to you" (first names alone can clash). */
    static String who(Lookup l, Long actor) {
        String n = l.name(actor);
        if (n == null || n.isBlank()) return "Someone";
        return n.strip();
    }

    static String label(Status s) {
        return switch (s) {
            case OPEN -> "Open";
            case IN_PROGRESS -> "In Progress";
            case CODE_REVIEW -> "Code Review";
            case TESTING -> "Testing";
            case READY_FOR_DEPLOYMENT -> "Ready for Deployment";
            case DEPLOYED -> "Deployed";
            case PRODUCTION_VERIFICATION -> "Production Verification";
            case CLOSED -> "Closed";
            case BLOCKED -> "Blocked";
        };
    }
}

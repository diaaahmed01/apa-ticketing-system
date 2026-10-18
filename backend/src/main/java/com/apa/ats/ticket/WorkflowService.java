package com.apa.ats.ticket;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import com.apa.ats.notification.TicketMailer;
import com.apa.ats.permission.AccessGuard;
import com.apa.ats.permission.Condition;
import com.apa.ats.ticket.TicketEnums.Closure;
import com.apa.ats.ticket.TicketEnums.LinkType;
import com.apa.ats.ticket.TicketEnums.PersonKind;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketRecords.TicketLink;
import com.apa.ats.ticket.TicketRecords.TicketPerson;
import com.apa.ats.ticket.TicketViews.Detail;
import com.apa.ats.ticket.TicketViews.Lookup;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ticket status transitions. Each one checks, in order: ticket open, version, state, permission,
 * then the workflow invariants (reviewer/tester independence, required reasons) that hold
 * whatever the grants say.
 */
@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final TicketService tickets;
    private final TicketRecords.Tickets ticketRepo;
    private final TicketRecords.People people;
    private final TicketRecords.Links links;
    private final AccessGuard guard;
    private final TicketNotifier notifier;
    private final TicketMailer mailer;

    public record VerifyResult(Detail ticket, Long followUpId) {}

    /** Optional edits to the follow-up ticket opened by a failed verification; blank fields keep the copied defaults. */
    public record FollowUpInput(String title, String description, String type, String priority, Long moduleId,
                                String environment, Long assigneeId, boolean unassigned) {}

    /** The ticket being moved, with everything the checks need. */
    private record Ctx(Ticket t, CurrentUser me, List<TicketPerson> ps, Set<Condition> rel, Lookup l) {
        Long id() { return t.getId(); }
        Set<Long> contributors() { return WorkflowActions.contributorIds(ps); }
    }

    /* ------------------------------------------------------------------ transitions */

    @Transactional
    public Detail start(Long id, Integer version) {
        Ctx c = open(id, version, Status.OPEN);
        guard.require("TICKET_START_WORK", c.rel());
        if (c.t().getAssigneeId() == null) throw ApiException.badRequest("NO_ASSIGNEE", "Assign the ticket before starting work.");
        move(c, Status.IN_PROGRESS, null);
        return done(c);
    }

    @Transactional
    public Detail submitReview(Long id, Integer version, List<Long> contributorIds, Long reviewerId) {
        Ctx c = open(id, version, Status.IN_PROGRESS);
        Ticket t = c.t();
        guard.require("REVIEW_SUBMIT", c.rel());
        if (reviewerId != null && !reviewerId.equals(t.getReviewerId())) {
            guard.require("ASSIGN_REVIEWER", c.rel());
            TicketService.activeUser(reviewerId, c.l(), "reviewer");
            tickets.log(id, c.me().id(), "REVIEWER_CHANGED", "reviewer", c.l().name(t.getReviewerId()), c.l().name(reviewerId), null);
            t.setReviewerId(reviewerId);
        }
        if (t.getReviewerId() == null) throw ApiException.badRequest("NO_REVIEWER", "Choose a code reviewer before submitting for review.");
        if (t.getReviewerId().equals(t.getTesterId())) {
            throw ApiException.badRequest("SAME_REVIEWER_TESTER", "Choose different people for reviewer and tester.");
        }
        Set<Long> contributors = contributorSet(c, contributorIds);
        checkIndependent(c, contributors);
        replaceContributors(c, contributors);
        t.setTestResult(null);
        move(c, Status.CODE_REVIEW, null);
        tickets.log(id, c.me().id(), "REVIEW_SUBMITTED", null, null, c.l().name(t.getReviewerId()), null);
        Detail d = done(c);
        notifier.reviewRequested(t, c.l(), c.me().id());
        return d;
    }

    @Transactional
    public Detail skipReview(Long id, Integer version, String reason) {
        Ctx c = open(id, version, Status.IN_PROGRESS);
        guard.require("REVIEW_SKIP", c.rel());
        String why = reason(reason, true);
        c.t().setTestResult(null);
        move(c, Status.TESTING, why);
        tickets.log(c.id(), c.me().id(), "REVIEW_SKIPPED", null, null, null, null);
        Detail d = done(c);
        notifier.testRequested(c.t(), c.l(), c.me().id(), why);
        return d;
    }

    @Transactional
    public Detail review(Long id, Integer version, String decision, String reason) {
        Ctx c = open(id, version, Status.CODE_REVIEW);
        guard.require("REVIEW_DECIDE", c.rel());
        Long me = c.me().id();
        if (!me.equals(c.t().getReviewerId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_REVIEWER", "Only the assigned reviewer can review this ticket.");
        }
        if (c.contributors().contains(me)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_REVIEWER", "You contributed code to this ticket, so you can't review it.");
        }
        boolean approve = passFail(decision, "APPROVE", "REJECT");
        String why = reason(reason, !approve);
        move(c, approve ? Status.TESTING : Status.IN_PROGRESS, why);
        tickets.log(c.id(), me, approve ? "REVIEW_APPROVED" : "REVIEW_REJECTED", null, null, null, null);
        Detail d = done(c);
        if (approve) notifier.reviewApproved(c.t(), c.l(), me, why);
        else notifier.reviewRejected(c.t(), c.l(), me, why);
        return d;
    }

    @Transactional
    public Detail testResult(Long id, Integer version, String result, String reason) {
        Ctx c = open(id, version, Status.TESTING);
        guard.require("TEST_RECORD_RESULT", c.rel());
        Long me = c.me().id();
        if (c.t().getTesterId() == null) throw ApiException.badRequest("NO_TESTER", "Assign a tester before recording a test result.");
        if (!me.equals(c.t().getTesterId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_TESTER", "Only the assigned tester can record the test result.");
        }
        if (c.contributors().contains(me)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_TESTER", "You contributed code to this ticket, so you can't test it.");
        }
        boolean pass = passFail(result, "PASS", "FAIL");
        String why = reason(reason, !pass);
        if (pass) {
            c.t().setTestResult("PASSED");
            tickets.log(c.id(), me, "TEST_PASSED", null, null, null, why);
        } else {
            c.t().setTestResult("FAILED");
            move(c, Status.IN_PROGRESS, why);
            tickets.log(c.id(), me, "TEST_FAILED", null, null, null, null);
        }
        Detail d = done(c);
        if (pass) notifier.testPassed(c.t(), c.l(), me, why);
        else notifier.testFailed(c.t(), c.l(), me, why);
        return d;
    }

    @Transactional
    public Detail markReady(Long id, Integer version) {
        Ctx c = open(id, version, Status.TESTING);
        guard.require("DEPLOY_MARK_READY", c.rel());
        if (!"PASSED".equals(c.t().getTestResult())) {
            throw ApiException.conflict("TEST_NOT_PASSED", "Testing must pass before the fix is ready for deployment.");
        }
        move(c, Status.READY_FOR_DEPLOYMENT, null);
        Detail d = done(c);
        notifier.statusChanged(c.t(), Status.READY_FOR_DEPLOYMENT, c.me().id(), null);
        return d;
    }

    @Transactional
    public Detail markDeployed(Long id, Integer version, String patchReference) {
        Ctx c = open(id, version, Status.READY_FOR_DEPLOYMENT);
        Ticket t = c.t();
        guard.require("DEPLOY_MARK_DEPLOYED", c.rel());
        String patch = TicketService.patch(patchReference);
        if (patch != null && !patch.equals(t.getPatchReference())) {
            guard.require("DEPLOY_SET_PATCH", c.rel());
            tickets.log(c.id(), c.me().id(), "FIELD_CHANGED", "patchReference", t.getPatchReference(), patch, null);
            t.setPatchReference(patch);
        }
        if (t.getPatchReference() == null) throw ApiException.badRequest("NO_PATCH", "Record the patch reference before marking deployed.");
        move(c, Status.DEPLOYED, null);
        move(c, Status.PRODUCTION_VERIFICATION, null);
        tickets.log(c.id(), c.me().id(), "DEPLOYED", "patchReference", null, t.getPatchReference(), null);
        Detail d = done(c);
        notifier.deployed(t, c.me().id());
        return d;
    }

    @Transactional
    public VerifyResult verify(Long id, Integer version, String result, String reason, String followUpTitle, FollowUpInput followUp) {
        Ctx c = open(id, version, Status.PRODUCTION_VERIFICATION);
        guard.require("VERIFY_RECORD_RESULT", c.rel());
        boolean pass = passFail(result, "PASS", "FAIL");
        String why = reason(reason, !pass);
        if (pass) {
            closeAs(c, Closure.RESOLVED, why);
            tickets.log(c.id(), c.me().id(), "VERIFIED", null, null, null, null);
            Detail d = done(c);
            notifier.closed(c.t(), c.l(), c.me().id(), Closure.RESOLVED, why);
            return new VerifyResult(d, null);
        }
        guard.require("VERIFY_CREATE_RELATED", c.rel());
        Ticket next = followUp(c, why, followUpTitle, followUp);
        closeAs(c, Closure.UNRESOLVED, why);
        tickets.log(c.id(), c.me().id(), "VERIFICATION_FAILED", null, null, "TKT-" + next.getId(), null);
        tickets.log(c.id(), c.me().id(), "FOLLOW_UP_CREATED", "followUp", null, "TKT-" + next.getId(), null);
        Detail d = done(c);
        notifier.verificationFailed(c.t(), next, c.l(), c.me().id(), why);
        if (next.getAssigneeId() != null && !next.getAssigneeId().equals(c.t().getAssigneeId())) {
            notifier.assigned(next, c.l(), c.me().id(), next.getAssigneeId());
        }
        return new VerifyResult(d, next.getId());
    }

    @Transactional
    public Detail block(Long id, Integer version, String reason, Long blockedByTicketId, String blockPatch) {
        Ctx c = open(id, version);
        Ticket t = c.t();
        if (t.getStatus() == Status.BLOCKED) throw ApiException.conflict("TICKET_BLOCKED", "TKT-" + id + " is already blocked.");
        guard.require("TICKET_BLOCK", c.rel());
        String why = reason(reason, true);
        String patch = TicketService.patch(blockPatch);
        if (blockedByTicketId == null && patch == null) {
            throw ApiException.badRequest("NO_DEPENDENCY", "Say what it's waiting for: a ticket or a patch.");
        }
        Ticket dependency = null;
        if (blockedByTicketId != null) {
            if (blockedByTicketId.equals(id)) throw ApiException.badRequest("SELF_LINK", "A ticket can't be blocked by itself.");
            dependency = ticketRepo.findById(blockedByTicketId)
                    .orElseThrow(() -> ApiException.badRequest("UNKNOWN_TICKET", "TKT-" + blockedByTicketId + " doesn't exist."));
            if (dependency.isClosed()) throw ApiException.badRequest("BLOCKER_CLOSED", "TKT-" + blockedByTicketId + " is already closed, so this can't be waiting for it.");
        }
        Instant now = Instant.now();
        t.setStatusBeforeBlock(t.getStatus());
        t.setBlockReason(why);
        t.setBlockPatch(patch);
        t.setBlockedBy(c.me().id());
        t.setBlockedAt(now);
        if (dependency != null) {
            TicketLink.Key key = new TicketLink.Key(id, dependency.getId(), LinkType.BLOCKED_BY);
            if (!links.existsById(key)) {
                TicketLink k = new TicketLink();
                k.setFromTicketId(id);
                k.setToTicketId(dependency.getId());
                k.setLinkType(LinkType.BLOCKED_BY);
                k.setCreatedAt(now);
                k.setCreatedBy(c.me().id());
                links.save(k);
            }
        }
        move(c, Status.BLOCKED, why);
        String waiting = dependency != null ? "TKT-" + dependency.getId() + (patch != null ? " and patch " + patch : "") : "patch " + patch;
        tickets.log(id, c.me().id(), "BLOCKED", "blockedBy", null, waiting, null);
        Detail d = done(c);
        notifier.blocked(t, c.l(), c.me().id(), why);
        return d;
    }

    @Transactional
    public Detail unblock(Long id, Integer version, String note) {
        Ctx c = open(id, version, Status.BLOCKED);
        guard.require("TICKET_UNBLOCK", c.rel());
        String why = reason(note, false);
        Ticket t = c.t();
        Status back = t.getStatusBeforeBlock() == null ? Status.OPEN : t.getStatusBeforeBlock();
        clearBlock(t);
        links.deleteAll(blockLinks(id));
        move(c, back, why);
        tickets.log(id, c.me().id(), "UNBLOCKED", null, null, null, null);
        Detail d = done(c);
        notifier.unblocked(t, c.l(), c.me().id(), why);
        return d;
    }

    @Transactional
    public Detail cancel(Long id, Integer version, String reason) {
        Ctx c = open(id, version);
        guard.require("TICKET_CANCEL", c.rel());
        String why = reason(reason, true);
        closeAs(c, Closure.CANCELLED, why);
        tickets.log(id, c.me().id(), "CANCELLED", null, null, null, null);
        Detail d = done(c);
        notifier.closed(c.t(), c.l(), c.me().id(), Closure.CANCELLED, why);
        return d;
    }

    @Transactional
    public Detail close(Long id, Integer version, String reason) {
        Ctx c = open(id, version);
        guard.require("TICKET_CLOSE", c.rel());
        String why = reason(reason, true);
        closeAs(c, Closure.UNRESOLVED, why);
        tickets.log(id, c.me().id(), "CLOSED_UNRESOLVED", null, null, null, null);
        Detail d = done(c);
        notifier.closed(c.t(), c.l(), c.me().id(), Closure.UNRESOLVED, why);
        return d;
    }

    @Transactional
    public Detail contributors(Long id, Integer version, List<Long> contributorIds) {
        Ctx c = open(id, version, Status.IN_PROGRESS, Status.CODE_REVIEW);
        guard.require("CODE_CONTRIBUTOR_MANAGE", c.rel());
        Set<Long> next = contributorSet(c, contributorIds);
        checkIndependent(c, next);
        replaceContributors(c, next);
        return done(c);
    }

    /* ------------------------------------------------------------------ helpers */

    /**
     * Loads the ticket and runs the shared checks. With no {@code allowed} statuses any status will do
     * (block, cancel, close). While blocked, everything else is refused.
     */
    private Ctx open(Long id, Integer version, Status... allowed) {
        Ticket t = tickets.loadOpen(id);
        TicketService.checkVersion(t, version);
        CurrentUser me = CurrentUser.require();
        List<Status> ok = List.of(allowed);
        if (!ok.isEmpty() && !ok.contains(t.getStatus())) {
            if (t.getStatus() == Status.BLOCKED) {
                throw ApiException.conflict("TICKET_BLOCKED", "TKT-" + id + " is blocked. Unblock it first.");
            }
            throw ApiException.conflict("WRONG_STATE", "That step isn't available while the ticket is " + label(t.getStatus()) + ".");
        }
        List<TicketPerson> ps = people.findByTicketId(id);
        return new Ctx(t, me, ps, TicketService.relationships(t, ps, me.id()), tickets.lookup());
    }

    private static String label(Status s) {
        return s.name().toLowerCase().replace('_', ' ');
    }

    /** Sets the new status and logs the change; the reason (if any) rides on the STATUS_CHANGED row. */
    private void move(Ctx c, Status to, String note) {
        Status from = c.t().getStatus();
        c.t().setStatus(to);
        tickets.log(c.id(), c.me().id(), "STATUS_CHANGED", "status", from.name(), to.name(), note);
    }

    private void closeAs(Ctx c, Closure closure, String reason) {
        Ticket t = c.t();
        clearBlock(t);
        t.setClosureStatus(closure);
        t.setClosureReason(reason);
        t.setClosedBy(c.me().id());
        t.setClosedAt(Instant.now());
        move(c, Status.CLOSED, reason);
    }

    private static void clearBlock(Ticket t) {
        t.setStatusBeforeBlock(null);
        t.setBlockReason(null);
        t.setBlockPatch(null);
        t.setBlockedBy(null);
        t.setBlockedAt(null);
    }

    private List<TicketLink> blockLinks(Long id) {
        return links.findByFromTicketIdOrToTicketId(id, id).stream()
                .filter(k -> k.getLinkType() == LinkType.BLOCKED_BY && k.getFromTicketId().equals(id)).toList();
    }

    private Detail done(Ctx c) {
        TicketService.touch(c.t(), c.me().id());
        ticketRepo.saveAndFlush(c.t());
        return tickets.toDetail(c.t(), c.l());
    }

    /** Required reasons error out when blank; optional ones come back null when blank. */
    private static String reason(String v, boolean required) {
        String s = v == null ? "" : v.strip();
        if (s.isEmpty()) {
            if (required) throw ApiException.badRequest("REASON_REQUIRED", "Give a reason.");
            return null;
        }
        if (s.length() > 2000) throw ApiException.badRequest("TOO_LONG", "Keep the reason under 2,000 characters.");
        return s;
    }

    /** True for the first option; anything but the two options is rejected. */
    private static boolean passFail(String v, String yes, String no) {
        if (yes.equals(v)) return true;
        if (no.equals(v)) return false;
        throw ApiException.badRequest("BAD_VALUE", "Choose " + yes.toLowerCase() + " or " + no.toLowerCase() + ".");
    }

    /** The assignee plus the chosen people, all active users. */
    private Set<Long> contributorSet(Ctx c, List<Long> ids) {
        if (c.t().getAssigneeId() == null) throw ApiException.badRequest("NO_ASSIGNEE", "Assign the ticket before recording who contributed code.");
        Set<Long> out = new LinkedHashSet<>();
        out.add(c.t().getAssigneeId());
        if (ids != null) ids.stream().filter(Objects::nonNull).forEach(out::add);
        out.forEach(uid -> TicketService.activeUser(uid, c.l(), "contributor"));
        return out;
    }

    /** Reviewer and tester must not have contributed code, whatever the grants say. */
    private static void checkIndependent(Ctx c, Set<Long> contributors) {
        Long reviewer = c.t().getReviewerId();
        Long tester = c.t().getTesterId();
        if (reviewer != null && contributors.contains(reviewer)) {
            throw ApiException.conflict("REVIEWER_NOT_INDEPENDENT", "The reviewer can't be one of the code contributors.");
        }
        if (tester != null && contributors.contains(tester)) {
            throw ApiException.conflict("TESTER_NOT_INDEPENDENT", "The tester can't be one of the code contributors.");
        }
    }

    /** Makes the stored contributors equal {@code next}, adding and removing only the difference. */
    private void replaceContributors(Ctx c, Set<Long> next) {
        Set<Long> current = c.contributors();
        Instant now = Instant.now();
        boolean changed = false;
        for (TicketPerson p : c.ps()) {
            if (p.getKind() == PersonKind.CONTRIBUTOR && !next.contains(p.getUserId())) {
                people.delete(p);
                changed = true;
            }
        }
        for (Long uid : next) {
            if (!current.contains(uid)) {
                tickets.addPerson(c.id(), uid, PersonKind.CONTRIBUTOR, c.me().id(), now);
                changed = true;
            }
        }
        if (changed) {
            tickets.log(c.id(), c.me().id(), "CONTRIBUTORS_CHANGED", "contributors",
                    current.stream().map(c.l()::name).collect(Collectors.joining(", ")),
                    next.stream().map(c.l()::name).collect(Collectors.joining(", ")), null);
        }
    }

    /**
     * Opens the follow-up ticket for a failed production verification and links it to the original.
     * Anything the caller leaves out falls back to a copy of the original (title "Follow-up: ...", description =
     * the reason plus a reference, same assignee).
     */
    private Ticket followUp(Ctx c, String reason, String requestedTitle, FollowUpInput in) {
        Ticket o = c.t();
        Instant now = Instant.now();
        Lookup l = c.l();
        FollowUpInput f = in == null ? new FollowUpInput(null, null, null, null, null, null, null, false) : in;

        String title;
        if (!blank(f.title())) {
            title = TicketService.title(f.title());
        } else {
            title = blank(requestedTitle) ? "Follow-up: " + o.getTitle() : requestedTitle;
            title = title.strip().replaceAll("\\s+", " ");
            if (title.length() > 200) title = title.substring(0, 200).strip();
        }

        Ticket n = new Ticket();
        n.setTitle(title);
        n.setDescription(!blank(f.description()) ? TicketService.description(f.description())
                : reason + "\n\nFollow-up of TKT-" + o.getId() + " (failed production verification).");
        n.setType(!blank(f.type()) ? TicketService.parse(TicketEnums.Type.class, f.type(), "type") : o.getType());
        n.setPriority(!blank(f.priority()) ? TicketService.parse(TicketEnums.Priority.class, f.priority(), "priority") : o.getPriority());
        n.setModuleId(f.moduleId() != null ? TicketService.activeModule(f.moduleId(), l).id() : o.getModuleId());
        n.setEnvironment(!blank(f.environment()) ? TicketService.parse(TicketEnums.Environment.class, f.environment(), "environment") : o.getEnvironment());
        n.setStatus(Status.OPEN);
        n.setCreatedBy(c.me().id());
        n.setCreatedAt(now);

        Long assigneeId = null;
        if (f.unassigned()) {
            assigneeId = null;
        } else if (f.assigneeId() != null) {
            if (!f.assigneeId().equals(o.getAssigneeId())) guard.require("ASSIGN_TICKET", c.rel());
            assigneeId = TicketService.activeUser(f.assigneeId(), l, "assignee").id();
        } else {
            var carried = o.getAssigneeId() == null ? null : l.users().get(o.getAssigneeId());
            if (carried != null && carried.active()) assigneeId = carried.id();
        }
        if (assigneeId != null) {
            n.setAssigneeId(assigneeId);
            n.setAssignedBy(c.me().id());
            n.setAssignedAt(now);
        }
        n = ticketRepo.saveAndFlush(n);

        TicketLink k = new TicketLink();
        k.setFromTicketId(n.getId());
        k.setToTicketId(o.getId());
        k.setLinkType(LinkType.FOLLOW_UP_OF);
        k.setCreatedAt(now);
        k.setCreatedBy(c.me().id());
        links.save(k);

        tickets.log(n.getId(), c.me().id(), "CREATED", null, null, null, "Follow-up of TKT-" + o.getId());
        if (n.getAssigneeId() != null) tickets.log(n.getId(), c.me().id(), "ASSIGNEE_CHANGED", "assignee", null, l.name(n.getAssigneeId()), null);
        mailer.ticketCreated(n, l, o.getId());
        return n;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}

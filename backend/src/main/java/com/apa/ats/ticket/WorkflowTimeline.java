package com.apa.ats.ticket;

import com.apa.ats.ticket.DiscussionRecords.Attachment;
import com.apa.ats.ticket.TicketEnums.LinkType;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketRecords.TicketActivity;
import com.apa.ats.ticket.TicketRecords.TicketLink;
import com.apa.ats.ticket.TicketViews.Lookup;
import com.apa.ats.ticket.TicketViews.PersonRef;
import com.apa.ats.ticket.WorkflowViews.Block;
import com.apa.ats.ticket.WorkflowViews.Current;
import com.apa.ats.ticket.WorkflowViews.Deployment;
import com.apa.ats.ticket.WorkflowViews.Review;
import com.apa.ats.ticket.WorkflowViews.ReviewRound;
import com.apa.ats.ticket.WorkflowViews.Stage;
import com.apa.ats.ticket.WorkflowViews.TestRound;
import com.apa.ats.ticket.WorkflowViews.Testing;
import com.apa.ats.ticket.WorkflowViews.Verification;
import com.apa.ats.ticket.WorkflowViews.Workflow;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a ticket's activity log (oldest first) into the workflow tabs: stage timeline, review rounds, test rounds,
 * deployment and blocks. Pure: no database, no Spring. It relies on how {@link WorkflowService} writes the log:
 * a STATUS_CHANGED row (carrying the reason in its note) comes just before the REVIEW_*, TEST_FAILED, VERIFIED,
 * VERIFICATION_FAILED and BLOCKED rows of the same step, so those reasons are read from the status row before them.
 */
final class WorkflowTimeline {

    private static final Pattern TICKET_NO = Pattern.compile("TKT-(\\d+)");
    private static final Pattern PATCH = Pattern.compile("patch\\s+(.+)$");

    private WorkflowTimeline() {}

    /** Ids of other tickets mentioned by the log (blocked-by and follow-up), so the caller can load them in one go. */
    static Set<Long> referencedTicketIds(List<TicketActivity> acts) {
        Set<Long> out = new LinkedHashSet<>();
        for (TicketActivity a : acts) {
            if (!"BLOCKED".equals(a.getAction()) && !"VERIFICATION_FAILED".equals(a.getAction())) continue;
            Long id = ticketNo(a.getNewValue());
            if (id != null) out.add(id);
        }
        return out;
    }

    static Workflow build(Ticket t, List<TicketActivity> acts, List<TicketLink> links, Map<Long, Ticket> others,
                          List<Attachment> evidence, List<PersonRef> contributors, Lookup l) {
        List<ReviewRound> reviewRounds = new ArrayList<>();
        List<MutableTestRound> testRounds = new ArrayList<>();
        List<MutableBlock> blocks = new ArrayList<>();
        Instant readyAt = null;
        Long readyBy = null;
        Instant deployedAt = null;
        Long deployedBy = null;
        Verification verification = null;

        TicketActivity lastStatus = null;
        List<String> lastContributors = null;
        PendingReview open = null;
        for (TicketActivity a : acts) {
            String action = a.getAction() == null ? "" : a.getAction();
            switch (action) {
                case "STATUS_CHANGED" -> {
                    if (!"status".equals(a.getField())) break;
                    lastStatus = a;
                    if ("TESTING".equals(a.getNewValue())) testRounds.add(new MutableTestRound(a.getCreatedAt()));
                    if ("TESTING".equals(a.getOldValue()) && !testRounds.isEmpty()) {
                        MutableTestRound r = testRounds.get(testRounds.size() - 1);
                        if (r.endAt == null) r.endAt = a.getCreatedAt();
                    }
                    if ("READY_FOR_DEPLOYMENT".equals(a.getNewValue())) {
                        readyAt = a.getCreatedAt();
                        readyBy = a.getActorId();
                    }
                    if ("BLOCKED".equals(a.getOldValue())) {
                        MutableBlock b = lastOpen(blocks);
                        if (b != null) {
                            b.unblockedAt = a.getCreatedAt();
                            b.unblockedBy = a.getActorId();
                            b.note = a.getNote();
                        }
                    }
                }
                case "CONTRIBUTORS_CHANGED" -> lastContributors = names(a.getNewValue());
                case "REVIEW_SUBMITTED" -> {
                    if (open != null) reviewRounds.add(open.round(null, null, null, null, l));
                    open = new PendingReview(a.getCreatedAt(), a.getActorId(), lastContributors);
                }
                case "REVIEW_APPROVED", "REVIEW_REJECTED" -> {
                    PendingReview p = open != null ? open : new PendingReview(null, null, null);
                    reviewRounds.add(p.round("REVIEW_APPROVED".equals(action) ? "APPROVED" : "REJECTED", reasonFrom(lastStatus, a),
                            a.getCreatedAt(), a.getActorId(), l));
                    open = null;
                }
                case "REVIEW_SKIPPED" -> reviewRounds.add(new ReviewRound(a.getCreatedAt(), l.person(a.getActorId()), null, "SKIPPED",
                        reasonFrom(lastStatus, a), a.getCreatedAt(), l.person(a.getActorId())));
                case "TEST_PASSED", "TEST_FAILED" -> {
                    boolean pass = "TEST_PASSED".equals(action);
                    MutableTestRound r = testRounds.isEmpty() ? null : testRounds.get(testRounds.size() - 1);
                    if (r == null || r.result != null) {
                        // A second result in the same visit to testing starts a new round where the last one ended.
                        MutableTestRound next = new MutableTestRound(r == null ? a.getCreatedAt() : r.testedAt);
                        if (r != null) r.endAt = r.testedAt;
                        testRounds.add(next);
                        r = next;
                    }
                    r.result = pass ? "PASSED" : "FAILED";
                    r.notes = pass ? a.getNote() : reasonFrom(lastStatus, a);
                    r.testedBy = a.getActorId();
                    r.testedAt = a.getCreatedAt();
                }
                case "BLOCKED" -> {
                    MutableBlock b = new MutableBlock();
                    b.reason = reasonFrom(lastStatus, a);
                    b.blockedAt = a.getCreatedAt();
                    b.blockedBy = a.getActorId();
                    b.ticketId = ticketNo(a.getNewValue());
                    Matcher m = a.getNewValue() == null ? null : PATCH.matcher(a.getNewValue());
                    b.patch = m != null && m.find() ? m.group(1).strip() : null;
                    blocks.add(b);
                }
                case "DEPLOYED" -> {
                    deployedAt = a.getCreatedAt();
                    deployedBy = a.getActorId();
                    verification = null;
                }
                case "VERIFIED" -> verification = new Verification("PASSED", a.getCreatedAt(), l.person(a.getActorId()),
                        reasonFrom(lastStatus, a), null);
                case "VERIFICATION_FAILED" -> {
                    Long id = ticketNo(a.getNewValue());
                    Ticket f = id == null ? null : others.get(id);
                    verification = new Verification("FAILED", a.getCreatedAt(), l.person(a.getActorId()),
                            reasonFrom(lastStatus, a), f == null ? null : TicketViews.card(f, l));
                }
                default -> { }
            }
        }
        if (open != null) reviewRounds.add(open.round(null, null, null, null, l));

        Status now = t.getStatus();
        boolean inReview = now == Status.CODE_REVIEW || (now == Status.BLOCKED && t.getStatusBeforeBlock() == Status.CODE_REVIEW);
        boolean inTesting = now == Status.TESTING || (now == Status.BLOCKED && t.getStatusBeforeBlock() == Status.TESTING);

        Review review = new Review(l.person(t.getReviewerId()), contributors, reviewStatus(reviewRounds, inReview), reviewRounds);

        List<TestRound> tests = new ArrayList<>();
        for (MutableTestRound r : testRounds) tests.add(r.view(evidence, l));
        Testing testing = new Testing(l.person(t.getTesterId()), testStatus(tests, inTesting), tests);

        Deployment deployment = new Deployment(t.getPatchReference(), readyAt, l.person(readyBy), deployedAt, l.person(deployedBy), verification);

        return new Workflow(stages(t, acts, l), current(t, links, others, l), review, testing, deployment, blocks(t, blocks, links, others, l));
    }

    /* ------------------------------------------------------------------ stages */

    /** The ticket is OPEN from creation; every STATUS_CHANGED row starts the next stage and ends the one before. */
    private static List<Stage> stages(Ticket t, List<TicketActivity> acts, Lookup l) {
        List<Instant> at = new ArrayList<>();
        List<String> status = new ArrayList<>();
        List<Long> by = new ArrayList<>();
        List<String> note = new ArrayList<>();
        at.add(t.getCreatedAt());
        status.add(Status.OPEN.name());
        by.add(t.getCreatedBy());
        note.add(null);
        for (TicketActivity a : acts) {
            if (!"STATUS_CHANGED".equals(a.getAction()) || !"status".equals(a.getField()) || a.getNewValue() == null) continue;
            at.add(a.getCreatedAt());
            status.add(a.getNewValue());
            by.add(a.getActorId());
            note.add(a.getNote());
        }
        List<Stage> out = new ArrayList<>();
        for (int i = 0; i < at.size(); i++) {
            Instant left = i + 1 < at.size() ? at.get(i + 1) : null;
            out.add(new Stage(status.get(i), at.get(i), l.person(by.get(i)), note.get(i), left));
        }
        return out;
    }

    /* ------------------------------------------------------------------ now */

    private static Current current(Ticket t, List<TicketLink> links, Map<Long, Ticket> others, Lookup l) {
        PersonRef assignee = l.person(t.getAssigneeId());
        String status = t.getStatus().name();
        return switch (t.getStatus()) {
            case OPEN -> assignee != null ? new Current(status, assignee, "Start work") : new Current(status, null, "Assign the ticket");
            case IN_PROGRESS -> new Current(status, assignee, "Finish the fix and submit for review");
            case CODE_REVIEW -> new Current(status, l.person(t.getReviewerId()), "Review the code");
            case TESTING -> "PASSED".equals(t.getTestResult())
                    ? new Current(status, null, "Mark ready for deployment")
                    : new Current(status, l.person(t.getTesterId()), "Test the fix");
            case READY_FOR_DEPLOYMENT -> new Current(status, null, "Deploy the patch");
            case DEPLOYED, PRODUCTION_VERIFICATION -> new Current(status, l.person(t.getCreatedBy()), "Verify in production");
            case BLOCKED -> {
                Ticket dep = currentBlocker(t, links, others);
                String what = dep != null ? "TKT-" + dep.getId() : null;
                if (t.getBlockPatch() != null) what = what == null ? "patch " + t.getBlockPatch() : what + " and patch " + t.getBlockPatch();
                yield new Current(status, assignee, what == null ? "Waiting on a dependency" : "Waiting on " + what);
            }
            case CLOSED -> new Current(status, null, "Closed as " + (t.getClosureStatus() == null ? "closed" : capital(t.getClosureStatus().name())));
        };
    }

    /* ------------------------------------------------------------------ review and testing */

    private static String reviewStatus(List<ReviewRound> rounds, boolean inReview) {
        if (rounds.isEmpty()) return "NOT_SUBMITTED";
        ReviewRound last = rounds.get(rounds.size() - 1);
        if (last.decision() == null) return inReview ? "AWAITING" : "NOT_SUBMITTED";
        return last.decision();
    }

    private static String testStatus(List<TestRound> rounds, boolean inTesting) {
        if (rounds.isEmpty()) return "NOT_STARTED";
        TestRound last = rounds.get(rounds.size() - 1);
        if (last.result() != null) return last.result();
        return inTesting ? "AWAITING" : "NOT_STARTED";
    }

    /** A review round that was submitted; the decision (if any) is added when it arrives. */
    private record PendingReview(Instant submittedAt, Long submittedBy, List<String> contributors) {
        ReviewRound round(String decision, String reason, Instant decidedAt, Long decidedBy, Lookup l) {
            return new ReviewRound(submittedAt, l.person(submittedBy), contributors, decision, reason, decidedAt, l.person(decidedBy));
        }
    }

    private static final class MutableTestRound {
        final Instant startedAt;
        Instant endAt;
        String result;
        String notes;
        Long testedBy;
        Instant testedAt;

        MutableTestRound(Instant startedAt) {
            this.startedAt = startedAt;
        }

        /** Evidence belongs to the round whose window (entered testing .. left testing) the upload fell in. */
        TestRound view(List<Attachment> evidence, Lookup l) {
            List<DiscussionViews.AttachmentView> files = evidence.stream()
                    .filter(e -> e.getUploadedAt() != null && !e.getUploadedAt().isBefore(startedAt)
                            && (endAt == null || e.getUploadedAt().isBefore(endAt)))
                    .map(e -> DiscussionViews.attachment(e, l, false))
                    .toList();
            return new TestRound(startedAt, result, notes, l.person(testedBy), testedAt, files);
        }
    }

    /* ------------------------------------------------------------------ blocks */

    private static final class MutableBlock {
        String reason;
        Long ticketId;
        String patch;
        Instant blockedAt;
        Long blockedBy;
        Instant unblockedAt;
        Long unblockedBy;
        String note;
    }

    private static MutableBlock lastOpen(List<MutableBlock> blocks) {
        if (blocks.isEmpty()) return null;
        MutableBlock b = blocks.get(blocks.size() - 1);
        return b.unblockedAt == null ? b : null;
    }

    private static List<Block> blocks(Ticket t, List<MutableBlock> raw, List<TicketLink> links, Map<Long, Ticket> others, Lookup l) {
        List<MutableBlock> list = new ArrayList<>(raw);
        boolean blockedNow = t.getStatus() == Status.BLOCKED;
        MutableBlock open = lastOpen(list);
        if (blockedNow && open == null) {
            // Blocked without a matching log row: show what the ticket row says.
            open = new MutableBlock();
            list.add(open);
        }
        if (blockedNow) {
            // The ticket row is the source of truth for the current block.
            if (t.getBlockReason() != null) open.reason = t.getBlockReason();
            open.patch = t.getBlockPatch();
            if (t.getBlockedAt() != null) open.blockedAt = t.getBlockedAt();
            if (t.getBlockedBy() != null) open.blockedBy = t.getBlockedBy();
            Ticket dep = currentBlocker(t, links, others);
            if (dep != null) open.ticketId = dep.getId();
        }
        List<Block> out = new ArrayList<>();
        for (MutableBlock b : list) {
            Ticket dep = b.ticketId == null ? null : others.get(b.ticketId);
            out.add(new Block(b.reason, dep == null ? null : TicketViews.card(dep, l), b.patch, b.blockedAt, l.person(b.blockedBy),
                    b.unblockedAt, l.person(b.unblockedBy), b.note, blockedNow && b == open));
        }
        return out;
    }

    /** The ticket this one is waiting for right now: the newest outgoing BLOCKED_BY link. */
    private static Ticket currentBlocker(Ticket t, List<TicketLink> links, Map<Long, Ticket> others) {
        TicketLink best = null;
        for (TicketLink k : links) {
            if (k.getLinkType() != LinkType.BLOCKED_BY || !k.getFromTicketId().equals(t.getId())) continue;
            if (best == null || (k.getCreatedAt() != null && best.getCreatedAt() != null && k.getCreatedAt().isAfter(best.getCreatedAt()))) best = k;
        }
        return best == null ? null : others.get(best.getToTicketId());
    }

    /* ------------------------------------------------------------------ small helpers */

    /** The reason for a step: its own note, else the note on the status change logged just before it by the same person. */
    private static String reasonFrom(TicketActivity lastStatus, TicketActivity a) {
        if (a.getNote() != null) return a.getNote();
        if (lastStatus == null || lastStatus.getNote() == null) return null;
        return Objects.equals(lastStatus.getActorId(), a.getActorId()) ? lastStatus.getNote() : null;
    }

    static Long ticketNo(String text) {
        if (text == null) return null;
        Matcher m = TICKET_NO.matcher(text);
        return m.find() ? Long.valueOf(m.group(1)) : null;
    }

    private static List<String> names(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(",")).map(String::strip).filter(s -> !s.isEmpty()).toList();
    }

    private static String capital(String enumName) {
        return enumName.charAt(0) + enumName.substring(1).toLowerCase();
    }
}

package com.apa.ats.ticket;

import com.apa.ats.ticket.DiscussionViews.AttachmentView;
import com.apa.ats.ticket.TicketViews.Card;
import com.apa.ats.ticket.TicketViews.PersonRef;
import java.time.Instant;
import java.util.List;

/** API shapes for {@code GET /api/tickets/{id}/workflow}: the ticket's journey, derived from its activity log. */
public final class WorkflowViews {

    private WorkflowViews() {}

    /** One stay in a status. {@code leftAt} is null for the current stage. */
    public record Stage(String status, Instant enteredAt, PersonRef enteredBy, String note, Instant leftAt) {}

    /** Who has to act now and what they have to do. {@code waitingOn} is null when it isn't one particular person. */
    public record Current(String status, PersonRef waitingOn, String waitingFor) {}

    /** {@code contributors} are the names logged when the code was submitted, or null if none were logged. */
    public record ReviewRound(Instant submittedAt, PersonRef submittedBy, List<String> contributors, String decision,
                              String reason, Instant decidedAt, PersonRef decidedBy) {}

    /** status: NOT_SUBMITTED, AWAITING, APPROVED, REJECTED or SKIPPED. */
    public record Review(PersonRef reviewer, List<PersonRef> contributors, String status, List<ReviewRound> rounds) {}

    public record TestRound(Instant startedAt, String result, String notes, PersonRef testedBy, Instant testedAt,
                            List<AttachmentView> evidence) {}

    /** status: NOT_STARTED, AWAITING, PASSED or FAILED. */
    public record Testing(PersonRef tester, String status, List<TestRound> rounds) {}

    public record Verification(String result, Instant at, PersonRef by, String reason, Card followUp) {}

    public record Deployment(String patchReference, Instant readyAt, PersonRef readyBy, Instant deployedAt,
                             PersonRef deployedBy, Verification verification) {}

    public record Block(String reason, Card blockedByTicket, String blockPatch, Instant blockedAt, PersonRef blockedBy,
                        Instant unblockedAt, PersonRef unblockedBy, String note, boolean current) {}

    public record Workflow(List<Stage> stages, Current current, Review review, Testing testing, Deployment deployment,
                           List<Block> blocks) {}
}

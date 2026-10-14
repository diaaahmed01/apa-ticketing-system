package com.apa.ats.ticket;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.permission.AccessGuard;
import com.apa.ats.permission.Condition;
import com.apa.ats.ticket.TicketEnums.PersonKind;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketRecords.TicketPerson;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Which workflow actions the current user can take on a ticket right now (state + permissions + invariants). */
@Component
@RequiredArgsConstructor
public class WorkflowActions {

    private final AccessGuard guard;

    public List<String> of(Ticket t, Collection<TicketPerson> ps, Set<Condition> rel, CurrentUser me) {
        List<String> out = new ArrayList<>();
        if (t.isClosed()) return out;
        Set<Long> contributors = contributorIds(ps);
        boolean notContributor = !contributors.contains(me.id());
        Status s = t.getStatus();

        switch (s) {
            case OPEN -> {
                if (t.getAssigneeId() != null && guard.allows(me, "TICKET_START_WORK", rel)) out.add("start");
            }
            case IN_PROGRESS -> {
                if (guard.allows(me, "REVIEW_SUBMIT", rel)) out.add("submit-review");
                if (guard.allows(me, "REVIEW_SKIP", rel)) out.add("skip-review");
                if (guard.allows(me, "CODE_CONTRIBUTOR_MANAGE", rel)) out.add("contributors");
            }
            case CODE_REVIEW -> {
                if (me.id().equals(t.getReviewerId()) && notContributor && guard.allows(me, "REVIEW_DECIDE", rel)) out.add("review");
                if (guard.allows(me, "CODE_CONTRIBUTOR_MANAGE", rel)) out.add("contributors");
            }
            case TESTING -> {
                if (me.id().equals(t.getTesterId()) && notContributor && guard.allows(me, "TEST_RECORD_RESULT", rel)) out.add("test-result");
                if ("PASSED".equals(t.getTestResult()) && guard.allows(me, "DEPLOY_MARK_READY", rel)) out.add("mark-ready");
            }
            case READY_FOR_DEPLOYMENT -> {
                if (guard.allows(me, "DEPLOY_MARK_DEPLOYED", rel)) out.add("mark-deployed");
            }
            case PRODUCTION_VERIFICATION -> {
                if (guard.allows(me, "VERIFY_RECORD_RESULT", rel)) out.add("verify");
            }
            case BLOCKED -> {
                if (guard.allows(me, "TICKET_UNBLOCK", rel)) out.add("unblock");
            }
            default -> { }
        }
        if (s != Status.BLOCKED && guard.allows(me, "TICKET_BLOCK", rel)) out.add("block");
        if (guard.allows(me, "TICKET_CANCEL", rel)) out.add("cancel");
        if (guard.allows(me, "TICKET_CLOSE", rel)) out.add("close");
        return out;
    }

    static Set<Long> contributorIds(Collection<TicketPerson> ps) {
        return ps.stream().filter(p -> p.getKind() == PersonKind.CONTRIBUTOR).map(TicketPerson::getUserId)
                .collect(java.util.stream.Collectors.toSet());
    }
}

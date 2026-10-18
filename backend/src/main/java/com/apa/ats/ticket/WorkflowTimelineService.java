package com.apa.ats.ticket;

import com.apa.ats.permission.AccessGuard;
import com.apa.ats.ticket.DiscussionRecords.Purpose;
import com.apa.ats.ticket.TicketEnums.LinkType;
import com.apa.ats.ticket.TicketEnums.PersonKind;
import com.apa.ats.ticket.TicketRecords.TicketActivity;
import com.apa.ats.ticket.TicketRecords.TicketLink;
import com.apa.ats.ticket.TicketRecords.TicketPerson;
import com.apa.ats.ticket.TicketViews.Lookup;
import com.apa.ats.ticket.WorkflowViews.Workflow;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loads what {@link WorkflowTimeline} needs (one activity query, links, evidence, the few tickets it names) and runs it. */
@Service
@RequiredArgsConstructor
public class WorkflowTimelineService {

    private final TicketService tickets;
    private final TicketRecords.Tickets ticketRepo;
    private final TicketRecords.People people;
    private final TicketRecords.Links links;
    private final TicketRecords.Activities activities;
    private final DiscussionRecords.Attachments attachments;
    private final AccessGuard guard;

    @Transactional(readOnly = true)
    public Workflow workflow(Long id) {
        guard.require("TICKET_VIEW");
        Ticket t = tickets.load(id);
        Lookup l = tickets.lookup();

        List<TicketActivity> acts = activities.findByTicketIdOrderByCreatedAtAscIdAsc(id);
        List<TicketLink> blockLinks = links.findByFromTicketIdAndLinkType(id, LinkType.BLOCKED_BY);
        Set<Long> ids = new HashSet<>(WorkflowTimeline.referencedTicketIds(acts));
        blockLinks.forEach(k -> ids.add(k.getToTicketId()));
        Map<Long, Ticket> others = ids.isEmpty() ? Map.of()
                : ticketRepo.findAllById(ids).stream().collect(Collectors.toMap(Ticket::getId, Function.identity()));

        List<TicketPerson> ps = people.findByTicketId(id);
        List<TicketViews.PersonRef> contributors = ps.stream().filter(p -> p.getKind() == PersonKind.CONTRIBUTOR)
                .sorted((a, b) -> a.getAddedAt().compareTo(b.getAddedAt()))
                .map(p -> l.person(p.getUserId())).toList();

        return WorkflowTimeline.build(t, acts, blockLinks, others,
                attachments.findByTicketIdAndPurposeAndDeletedAtIsNullOrderByUploadedAtAscIdAsc(id, Purpose.EVIDENCE), contributors, l);
    }
}

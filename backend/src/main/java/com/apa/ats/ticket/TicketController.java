package com.apa.ats.ticket;

import com.apa.ats.ticket.TicketViews.Card;
import com.apa.ats.ticket.TicketViews.Detail;
import com.apa.ats.ticket.TicketViews.PageOf;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService service;

    public record AssignRequest(Long userId, Integer version) {}
    public record UserRequest(Long userId) {}
    public record TicketRequest(Long ticketId) {}

    @GetMapping
    public PageOf<Card> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) List<String> priority,
            @RequestParam(required = false) List<Long> module,
            @RequestParam(required = false) List<Long> assignee,
            @RequestParam(required = false) List<String> environment,
            @RequestParam(required = false) List<String> type,
            @RequestParam(required = false) List<Long> creator,
            @RequestParam(required = false) List<Long> reviewer,
            @RequestParam(required = false) List<Long> tester,
            @RequestParam(required = false) List<String> closure,
            @RequestParam(required = false) Boolean hasPatch,
            @RequestParam(defaultValue = "false") boolean mine,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdTo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate closedFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate closedTo,
            @RequestParam(defaultValue = "NEWEST") TicketSearch.Sort sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return service.search(new TicketSearch.Filter(q, status, priority, module, assignee, environment, type, creator,
                reviewer, tester, closure, hasPatch, mine, createdFrom, createdTo, closedFrom, closedTo, sort), page, size);
    }

    @GetMapping("/{id}")
    public Detail get(@PathVariable Long id) {
        return service.detail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Detail create(@RequestBody TicketService.CreateInput in) {
        return service.create(in);
    }

    @PutMapping("/{id}")
    public Detail update(@PathVariable Long id, @RequestBody TicketService.UpdateInput in) {
        return service.update(id, in);
    }

    @PutMapping("/{id}/assignee")
    public Detail assignee(@PathVariable Long id, @RequestBody AssignRequest r) {
        return service.assign(id, TicketService.Role.ASSIGNEE, r.userId(), r.version());
    }

    @PutMapping("/{id}/reviewer")
    public Detail reviewer(@PathVariable Long id, @RequestBody AssignRequest r) {
        return service.assign(id, TicketService.Role.REVIEWER, r.userId(), r.version());
    }

    @PutMapping("/{id}/tester")
    public Detail tester(@PathVariable Long id, @RequestBody AssignRequest r) {
        return service.assign(id, TicketService.Role.TESTER, r.userId(), r.version());
    }

    @PostMapping("/{id}/collaborators")
    public Detail addCollaborator(@PathVariable Long id, @RequestBody UserRequest r) {
        return service.addCollaborator(id, r.userId());
    }

    @DeleteMapping("/{id}/collaborators/{userId}")
    public Detail removeCollaborator(@PathVariable Long id, @PathVariable Long userId) {
        return service.removeCollaborator(id, userId);
    }

    @PostMapping("/{id}/related")
    public Detail addRelated(@PathVariable Long id, @RequestBody TicketRequest r) {
        return service.addRelated(id, r.ticketId());
    }

    @DeleteMapping("/{id}/related/{otherId}")
    public Detail removeRelated(@PathVariable Long id, @PathVariable Long otherId) {
        return service.removeRelated(id, otherId);
    }
}

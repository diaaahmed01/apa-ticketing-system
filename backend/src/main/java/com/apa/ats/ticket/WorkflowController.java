package com.apa.ats.ticket;

import com.apa.ats.ticket.TicketViews.Detail;
import com.apa.ats.ticket.WorkflowService.VerifyResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Status transitions. Every request carries the ticket {@code version} it was made against. */
@RestController
@RequestMapping("/api/tickets/{id}")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService service;
    private final WorkflowTimelineService timeline;

    public record VersionRequest(Integer version) {}
    public record SubmitReviewRequest(Integer version, List<Long> contributorIds, Long reviewerId) {}
    public record ReasonRequest(Integer version, String reason) {}
    public record ReviewRequest(Integer version, String decision, String reason) {}
    public record ResultRequest(Integer version, String result, String reason) {}
    public record DeployRequest(Integer version, String patchReference) {}
    public record VerifyRequest(Integer version, String result, String reason, String followUpTitle,
                                WorkflowService.FollowUpInput followUp) {}
    public record BlockRequest(Integer version, String reason, Long blockedByTicketId, String blockPatch) {}
    public record NoteRequest(Integer version, String note) {}
    public record ContributorsRequest(Integer version, List<Long> contributorIds) {}

    @GetMapping("/workflow")
    public WorkflowViews.Workflow workflow(@PathVariable Long id) {
        return timeline.workflow(id);
    }

    @PostMapping("/start")
    public Detail start(@PathVariable Long id, @RequestBody VersionRequest r) {
        return service.start(id, r.version());
    }

    @PostMapping("/submit-review")
    public Detail submitReview(@PathVariable Long id, @RequestBody SubmitReviewRequest r) {
        return service.submitReview(id, r.version(), r.contributorIds(), r.reviewerId());
    }

    @PostMapping("/skip-review")
    public Detail skipReview(@PathVariable Long id, @RequestBody ReasonRequest r) {
        return service.skipReview(id, r.version(), r.reason());
    }

    @PostMapping("/review")
    public Detail review(@PathVariable Long id, @RequestBody ReviewRequest r) {
        return service.review(id, r.version(), r.decision(), r.reason());
    }

    @PostMapping("/test-result")
    public Detail testResult(@PathVariable Long id, @RequestBody ResultRequest r) {
        return service.testResult(id, r.version(), r.result(), r.reason());
    }

    @PostMapping("/mark-ready")
    public Detail markReady(@PathVariable Long id, @RequestBody VersionRequest r) {
        return service.markReady(id, r.version());
    }

    @PostMapping("/mark-deployed")
    public Detail markDeployed(@PathVariable Long id, @RequestBody DeployRequest r) {
        return service.markDeployed(id, r.version(), r.patchReference());
    }

    @PostMapping("/verify")
    public VerifyResult verify(@PathVariable Long id, @RequestBody VerifyRequest r) {
        return service.verify(id, r.version(), r.result(), r.reason(), r.followUpTitle(), r.followUp());
    }

    @PostMapping("/block")
    public Detail block(@PathVariable Long id, @RequestBody BlockRequest r) {
        return service.block(id, r.version(), r.reason(), r.blockedByTicketId(), r.blockPatch());
    }

    @PostMapping("/unblock")
    public Detail unblock(@PathVariable Long id, @RequestBody NoteRequest r) {
        return service.unblock(id, r.version(), r.note());
    }

    @PostMapping("/cancel")
    public Detail cancel(@PathVariable Long id, @RequestBody ReasonRequest r) {
        return service.cancel(id, r.version(), r.reason());
    }

    @PostMapping("/close")
    public Detail close(@PathVariable Long id, @RequestBody ReasonRequest r) {
        return service.close(id, r.version(), r.reason());
    }

    @PostMapping("/contributors")
    public Detail contributors(@PathVariable Long id, @RequestBody ContributorsRequest r) {
        return service.contributors(id, r.version(), r.contributorIds());
    }
}

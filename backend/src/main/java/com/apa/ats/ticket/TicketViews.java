package com.apa.ats.ticket;

import com.apa.ats.common.ReferenceCache.ModuleSnap;
import com.apa.ats.common.ReferenceCache.UserSnap;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** API shapes for tickets. People and modules are resolved to small references. */
public final class TicketViews {

    private TicketViews() {}

    public record PersonRef(Long id, String fullName, String organization, String avatarColor, boolean active) {}
    public record ModuleRef(Long id, String name, String nameAr) {}

    public record Card(
            Long id, String title, String excerpt, String type, String priority, String status, String closure,
            ModuleRef module, String environment, PersonRef creator, PersonRef assignee, PersonRef assignedBy,
            PersonRef reviewer, PersonRef tester, String patchReference, Instant createdAt) {}

    public record PageOf<T>(List<T> items, long total, int page, int size) {}

    public record LinkView(String type, String direction, Card ticket) {}

    public record ActivityView(Long id, PersonRef actor, String action, String field, String oldValue,
                               String newValue, String note, Instant at) {}

    /** What the current user may do on this ticket; the UI only hides, the API enforces. */
    public record Abilities(boolean edit, boolean changePriority, boolean assign, boolean assignReviewer,
                            boolean assignTester, boolean addCollaborator, boolean removeCollaborator,
                            boolean link) {}

    public record Detail(
            Long id, String title, String description, String type, String priority, String status,
            String statusBeforeBlock, String closure, String closureReason, ModuleRef module, String environment,
            PersonRef creator, Instant createdAt, PersonRef assignee, PersonRef assignedBy, Instant assignedAt,
            PersonRef reviewer, PersonRef tester, List<PersonRef> collaborators, List<PersonRef> contributors,
            String patchReference, PersonRef closedBy, Instant closedAt, List<LinkView> links,
            List<ActivityView> activity, List<String> myRelationships, Abilities can, int version,
            Instant updatedAt, String testResult, String blockReason, String blockPatch, PersonRef blockedBy,
            Instant blockedAt, List<String> actions, int commentCount, int attachmentCount, boolean canComment,
            boolean canUpload, boolean canUploadEvidence) {}

    /** Users and modules by id, from the short-lived reference cache. */
    public record Lookup(Map<Long, UserSnap> users, Map<Long, ModuleSnap> modules) {

        public PersonRef person(Long id) {
            if (id == null) return null;
            UserSnap u = users.get(id);
            if (u == null) return new PersonRef(id, "Unknown user", null, null, false);
            return new PersonRef(u.id(), u.fullName(), u.organization(), u.avatarColor(), u.active());
        }

        public ModuleRef module(Long id) {
            ModuleSnap m = modules.get(id);
            return m == null ? new ModuleRef(id, "Unknown module", null) : new ModuleRef(m.id(), m.name(), m.nameAr());
        }

        public String name(Long userId) {
            PersonRef p = person(userId);
            return p == null ? null : p.fullName();
        }
    }

    public static Card card(Ticket t, Lookup l) {
        String d = t.getDescription() == null ? "" : t.getDescription().strip();
        String excerpt = d.length() > 240 ? d.substring(0, 240).strip() + "…" : d;
        return new Card(t.getId(), t.getTitle(), excerpt, t.getType().name(), t.getPriority().name(), t.getStatus().name(),
                t.getClosureStatus() == null ? null : t.getClosureStatus().name(), l.module(t.getModuleId()),
                t.getEnvironment().name(), l.person(t.getCreatedBy()), l.person(t.getAssigneeId()),
                l.person(t.getAssignedBy()), l.person(t.getReviewerId()), l.person(t.getTesterId()), t.getPatchReference(), t.getCreatedAt());
    }
}

package com.apa.ats.notification;

import com.apa.ats.common.ApiException;
import com.apa.ats.common.ReferenceCache;
import com.apa.ats.common.ReferenceCache.UserSnap;
import com.apa.ats.notification.NotificationRecords.Notification;
import com.apa.ats.ticket.Ticket;
import com.apa.ats.ticket.TicketRecords;
import com.apa.ats.ticket.TicketRecords.TicketPerson;
import com.apa.ats.ticket.TicketViews.Lookup;
import com.apa.ats.ticket.TicketViews.PersonRef;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes in-app notifications and serves them to the person they belong to. Ticket updates are in-app only;
 * the one email ATS sends (a new ticket, to the vendor side) is queued by {@link TicketMailer}.
 * {@link #notify} joins the caller's transaction, so notifications commit or roll back with the ticket change.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    static final int MAX_TITLE = 300;
    static final int MAX_BODY = 1000;

    private final NotificationRecords.Notifications notifications;
    private final TicketRecords.People people;
    private final ReferenceCache cache;

    public record NotificationView(Long id, String type, String title, String body, Long ticketId, PersonRef actor,
                                   Instant createdAt, boolean read) {}

    public record NotificationPage(List<NotificationView> items, long total, long unread) {}

    public record Unread(long unread) {}

    /* ------------------------------------------------------------------ writing */

    /**
     * Notifies each recipient once. Skips the actor, inactive users and nulls. In-app only: no email is queued.
     */
    @Transactional
    public void notify(Ticket t, String type, Long actorId, Collection<Long> recipients, String title, String body) {
        if (recipients == null || recipients.isEmpty()) return;
        Map<Long, UserSnap> snapshot = cache.get().users();
        Set<Long> targets = new LinkedHashSet<>();
        for (Long id : recipients) {
            if (id == null || id.equals(actorId)) continue;
            UserSnap u = snapshot.get(id);
            if (u != null && u.active()) targets.add(id);
        }
        if (targets.isEmpty()) return;

        Instant now = Instant.now();
        String cleanTitle = clip(title, MAX_TITLE);
        String cleanBody = body == null || body.isBlank() ? null : clip(body.strip(), MAX_BODY);

        for (Long uid : targets) {
            Notification n = new Notification();
            n.setUserId(uid);
            n.setTicketId(t == null ? null : t.getId());
            n.setType(type);
            n.setActorId(actorId);
            n.setTitle(cleanTitle);
            n.setBody(cleanBody);
            n.setCreatedAt(now);
            notifications.save(n);
        }
    }

    /** Creator, assignee, reviewer, tester, collaborators and contributors of the ticket. */
    @Transactional(readOnly = true)
    public Set<Long> involved(Ticket t) {
        Set<Long> out = new LinkedHashSet<>();
        out.add(t.getCreatedBy());
        out.add(t.getAssigneeId());
        out.add(t.getReviewerId());
        out.add(t.getTesterId());
        people.findByTicketId(t.getId()).stream().map(TicketPerson::getUserId).forEach(out::add);
        out.removeIf(Objects::isNull);
        return out;
    }

    private static String clip(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    /* ------------------------------------------------------------------ reading (current user only) */

    @Transactional(readOnly = true)
    public NotificationPage list(Long userId, boolean unreadOnly, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pr = PageRequest.of(Math.max(page, 0), safeSize);
        Page<Notification> result = unreadOnly
                ? notifications.findByUserIdAndReadAtIsNullOrderByCreatedAtDescIdDesc(userId, pr)
                : notifications.findByUserIdOrderByCreatedAtDescIdDesc(userId, pr);
        ReferenceCache.Snapshot s = cache.get();
        Lookup l = new Lookup(s.users(), s.modules());
        List<NotificationView> items = result.getContent().stream()
                .map(n -> new NotificationView(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getTicketId(),
                        l.person(n.getActorId()), n.getCreatedAt(), n.getReadAt() != null))
                .toList();
        return new NotificationPage(items, result.getTotalElements(), notifications.countByUserIdAndReadAtIsNull(userId));
    }

    @Transactional(readOnly = true)
    public Unread unread(Long userId) {
        return new Unread(notifications.countByUserIdAndReadAtIsNull(userId));
    }

    @Transactional
    public Unread markRead(Long userId, Long id) {
        Notification n = notifications.findById(id).filter(x -> x.getUserId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("That notification"));
        if (n.getReadAt() == null) notifications.markRead(id, userId, Instant.now());
        return unread(userId);
    }

    @Transactional
    public Unread markAllRead(Long userId) {
        notifications.markAllRead(userId, Instant.now());
        return new Unread(0);
    }
}

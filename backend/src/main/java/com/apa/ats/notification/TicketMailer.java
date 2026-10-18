package com.apa.ats.notification;

import com.apa.ats.config.AtsProperties;
import com.apa.ats.notification.NotificationRecords.EmailOutbox;
import com.apa.ats.notification.NotificationRecords.MailStatus;
import com.apa.ats.ticket.Ticket;
import com.apa.ats.ticket.TicketViews.Lookup;
import com.apa.ats.ticket.TicketViews.PersonRef;
import com.apa.ats.user.AtsUser;
import com.apa.ats.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The only email ATS queues: when a ticket is created (including the follow-up opened by a failed verification),
 * the vendor side hears about it. Recipients are the active VENDOR ("HQ") users that have an address plus the
 * addresses in {@code ats.mail.vendor-recipients}, never the creator. Every other update is in-app only.
 * Rows go to ATS_EMAIL_OUTBOX inside the caller's transaction; the dispatcher sends them while mail is enabled.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TicketMailer {

    static final int MAX_SUBJECT = 300;
    static final int MAX_DESCRIPTION = 2000;
    private static final Pattern ADDRESS = Pattern.compile("[^@\\s,;<>]+@[^@\\s,;<>]+\\.[^@\\s,;<>]+");

    private final NotificationRecords.Outbox outbox;
    private final UserRepository users;
    private final AtsProperties props;

    /** Queues one email per recipient. {@code followUpOf} is the original ticket's id when this ticket is a follow-up. */
    @Transactional
    public void ticketCreated(Ticket t, Lookup l, Long followUpOf) {
        List<String> to = recipients(t.getCreatedBy());
        if (to.isEmpty()) return;
        String subject = clip("[ATS] New ticket TKT-" + t.getId() + ": " + t.getTitle(), MAX_SUBJECT);
        String body = body(t, l, followUpOf);
        Instant now = Instant.now();
        for (String address : to) {
            EmailOutbox m = new EmailOutbox();
            m.setToAddress(address);
            m.setSubject(subject);
            m.setBodyText(body);
            m.setStatus(MailStatus.PENDING);
            m.setAttempts(0);
            m.setCreatedAt(now);
            outbox.save(m);
        }
    }

    /** Active VENDOR users with an address plus the configured extras, de-duplicated ignoring case, minus the creator. */
    List<String> recipients(Long creatorId) {
        Map<String, String> byKey = new LinkedHashMap<>();
        for (AtsUser u : users.findByOrganizationAndActiveTrue(AtsUser.Organization.VENDOR)) {
            add(byKey, u.getEmail());
        }
        List<String> extra = props.mail() == null ? null : props.mail().vendorRecipients();
        if (extra != null) {
            for (String raw : extra) {
                for (String part : raw == null ? new String[0] : raw.split("[,;]")) add(byKey, part);
            }
        }
        if (creatorId != null) {
            users.findById(creatorId).map(AtsUser::getEmail).ifPresent(e -> {
                if (e != null) byKey.remove(e.strip().toLowerCase(Locale.ROOT));
            });
        }
        return new ArrayList<>(byKey.values());
    }

    private static void add(Map<String, String> byKey, String raw) {
        if (raw == null || raw.isBlank()) return;
        String a = raw.strip();
        if (a.length() > 320 || !ADDRESS.matcher(a).matches()) {
            log.warn("Ignoring invalid new-ticket email address '{}'", a);
            return;
        }
        byKey.putIfAbsent(a.toLowerCase(Locale.ROOT), a);
    }

    private String body(Ticket t, Lookup l, Long followUpOf) {
        PersonRef creator = l.person(t.getCreatedBy());
        PersonRef assignee = l.person(t.getAssigneeId());
        String description = t.getDescription() == null ? "" : t.getDescription().strip();
        if (description.length() > MAX_DESCRIPTION) description = description.substring(0, MAX_DESCRIPTION).strip() + "…";

        StringBuilder sb = new StringBuilder();
        sb.append("TKT-").append(t.getId()).append(": ").append(t.getTitle()).append("\n");
        if (followUpOf != null) sb.append("Follow-up of TKT-").append(followUpOf).append("\n");
        sb.append("\n");
        sb.append("Type: ").append(label(t.getType().name())).append("\n");
        sb.append("Priority: ").append(label(t.getPriority().name())).append("\n");
        sb.append("Module: ").append(l.module(t.getModuleId()).name()).append("\n");
        sb.append("Environment: ").append(label(t.getEnvironment().name())).append("\n");
        sb.append("Created by: ").append(creator == null ? "Unknown" : creator.fullName() + " (" + org(creator) + ")").append("\n");
        sb.append("Assignee: ").append(assignee == null ? "Unassigned" : assignee.fullName()).append("\n\n");
        sb.append("Description:\n").append(description).append("\n\n");
        sb.append("Open the ticket: ").append(baseUrl()).append("/tickets/").append(t.getId()).append("\n");
        return sb.toString();
    }

    private static String org(PersonRef p) {
        return "VENDOR".equals(p.organization()) ? "HQ" : "Port";
    }

    /** CHANGE_REQUEST -> Change request. */
    private static String label(String enumName) {
        String s = enumName.toLowerCase(Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private String baseUrl() {
        String u = props.publicUrl() == null || props.publicUrl().isBlank() ? "http://localhost:3010" : props.publicUrl().strip();
        return u.endsWith("/") ? u.substring(0, u.length() - 1) : u;
    }

    private static String clip(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}

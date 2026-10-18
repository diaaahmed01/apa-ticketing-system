package com.apa.ats.ticket;

import com.apa.ats.ticket.TicketEnums.LinkType;
import com.apa.ats.ticket.TicketEnums.PersonKind;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Nationalized;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** The small tables around a ticket, and the repositories for all ticket data. */
public final class TicketRecords {

    private TicketRecords() {}

    @Getter
    @Setter
    @Entity
    @Table(name = "ATS_TICKET_PEOPLE")
    @IdClass(TicketPerson.Key.class)
    public static class TicketPerson {
        @Id private Long ticketId;
        @Id private Long userId;
        @Id @Enumerated(EnumType.STRING) private PersonKind kind;
        private Instant addedAt;
        private Long addedBy;

        @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
        public static class Key implements Serializable {
            private Long ticketId;
            private Long userId;
            private PersonKind kind;
        }
    }

    @Getter
    @Setter
    @Entity
    @Table(name = "ATS_TICKET_LINKS")
    @IdClass(TicketLink.Key.class)
    public static class TicketLink {
        @Id private Long fromTicketId;
        @Id private Long toTicketId;
        @Id @Enumerated(EnumType.STRING) private LinkType linkType;
        private Instant createdAt;
        private Long createdBy;

        @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
        public static class Key implements Serializable {
            private Long fromTicketId;
            private Long toTicketId;
            private LinkType linkType;
        }
    }

    @Getter
    @Setter
    @Entity
    @Table(name = "ATS_TICKET_ACTIVITY")
    public static class TicketActivity {
        @Id
        @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_ticket_activity_seq")
        @SequenceGenerator(name = "ats_ticket_activity_seq", sequenceName = "ATS_TICKET_ACTIVITY_SEQ", allocationSize = 1)
        private Long id;
        private Long ticketId;
        private Long actorId;
        private String action;
        private String field;
        @Nationalized private String oldValue;
        @Nationalized private String newValue;
        @Nationalized private String note;
        private Instant createdAt;
    }

    public interface Tickets extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {}

    public interface People extends JpaRepository<TicketPerson, TicketPerson.Key> {
        List<TicketPerson> findByTicketId(Long ticketId);
        List<TicketPerson> findByTicketIdIn(Collection<Long> ticketIds);
    }

    public interface Links extends JpaRepository<TicketLink, TicketLink.Key> {
        List<TicketLink> findByFromTicketIdOrToTicketId(Long from, Long to);
        List<TicketLink> findByToTicketIdAndLinkType(Long to, LinkType type);
        List<TicketLink> findByFromTicketIdAndLinkType(Long from, LinkType type);
    }

    public interface Activities extends JpaRepository<TicketActivity, Long> {
        List<TicketActivity> findTop300ByTicketIdOrderByCreatedAtDescIdDesc(Long ticketId);
        List<TicketActivity> findByTicketIdOrderByCreatedAtAscIdAsc(Long ticketId);
    }
}

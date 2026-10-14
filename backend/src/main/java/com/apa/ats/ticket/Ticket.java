package com.apa.ats.ticket;

import com.apa.ats.ticket.TicketEnums.Closure;
import com.apa.ats.ticket.TicketEnums.Environment;
import com.apa.ats.ticket.TicketEnums.Priority;
import com.apa.ats.ticket.TicketEnums.Status;
import com.apa.ats.ticket.TicketEnums.Type;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Nationalized;

/** A ticket. Its id is the public number (TKT-{id}). People are referenced by user id. */
@Getter
@Setter
@Entity
@Table(name = "ATS_TICKETS")
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ats_tickets_seq")
    @SequenceGenerator(name = "ats_tickets_seq", sequenceName = "ATS_TICKETS_SEQ", allocationSize = 1)
    private Long id;

    @Nationalized
    private String title;

    @Lob
    @Nationalized
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "TICKET_TYPE")
    private Type type;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private Long moduleId;

    @Enumerated(EnumType.STRING)
    private Environment environment;

    @Enumerated(EnumType.STRING)
    private Status status;

    @Enumerated(EnumType.STRING)
    private Status statusBeforeBlock;

    @Enumerated(EnumType.STRING)
    private Closure closureStatus;

    @Nationalized
    private String closureReason;

    private Long closedBy;
    private Instant closedAt;

    private Long assigneeId;
    private Long assignedBy;
    private Instant assignedAt;
    private Long reviewerId;
    private Long testerId;

    private String patchReference;

    private Long createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private Long updatedBy;

    @Version
    private int version;

    public boolean isClosed() {
        return status == Status.CLOSED;
    }
}

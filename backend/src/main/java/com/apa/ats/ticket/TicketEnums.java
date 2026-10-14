package com.apa.ats.ticket;

/** Value sets stored as their names in ATS_TICKETS. */
public final class TicketEnums {

    private TicketEnums() {}

    public enum Type { BUG, CHANGE_REQUEST }

    public enum Priority {
        CRITICAL, HIGH, MEDIUM, LOW;

        /** Sort rank: most urgent first. */
        public int rank() { return ordinal(); }
    }

    public enum Environment { PRODUCTION, TESTING }

    /** Workflow order matters: it drives the stepper. BLOCKED sits outside the line. */
    public enum Status {
        OPEN, IN_PROGRESS, CODE_REVIEW, TESTING, READY_FOR_DEPLOYMENT, DEPLOYED, PRODUCTION_VERIFICATION, CLOSED, BLOCKED
    }

    public enum Closure { RESOLVED, UNRESOLVED, CANCELLED }

    public enum PersonKind { COLLABORATOR, CONTRIBUTOR }

    public enum LinkType { RELATED, FOLLOW_UP_OF, BLOCKED_BY }
}

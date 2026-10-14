package com.apa.ats.permission;

/** How a grant is scoped. ALWAYS is unconditional; the rest are the user's relationship to the target. */
public enum Condition {
    ALWAYS("Always"),
    TICKET_CREATOR("Ticket creator"),
    CURRENT_ASSIGNEE("Current assignee"),
    COLLABORATOR("Collaborator"),
    ASSIGNED_REVIEWER("Assigned reviewer"),
    ASSIGNED_TESTER("Assigned tester"),
    COMMENT_AUTHOR("Comment author"),
    ATTACHMENT_OWNER("Attachment owner");

    private final String label;

    Condition(String label) { this.label = label; }

    public String label() { return label; }
}

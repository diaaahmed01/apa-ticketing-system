-- ============================================================================
-- ATS (APA Ticketing System) — V001: identity, access control, modules
--
-- Every ATS object is prefixed ATS_ so it can live beside Orbit in the same
-- schema today and be moved to its own schema later without renaming.
-- ATS users are completely separate from Orbit's users (no shared tables,
-- no shared login).
--
-- Statements are separated by ";" at end of line. The app's migration runner
-- applies this file once; a DBA can run it unchanged in SQL*Plus / Toad.
-- IDs come from explicit sequences (works on Oracle 11g and later).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE SEQUENCE ATS_USERS_SEQ START WITH 1000 INCREMENT BY 1 NOCACHE;

CREATE TABLE ATS_USERS (
  ID                    NUMBER(19)      NOT NULL,
  USERNAME              VARCHAR2(60)    NOT NULL,
  FULL_NAME             NVARCHAR2(150)  NOT NULL,
  EMAIL                 VARCHAR2(200),
  ORGANIZATION          VARCHAR2(20)    NOT NULL,
  PASSWORD_HASH         VARCHAR2(100)   NOT NULL,
  MUST_CHANGE_PASSWORD  NUMBER(1)       DEFAULT 1 NOT NULL,
  PASSWORD_CHANGED_AT   TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
  IS_ACTIVE             NUMBER(1)       DEFAULT 1 NOT NULL,
  FAILED_LOGINS         NUMBER(5)       DEFAULT 0 NOT NULL,
  LOCKED_UNTIL          TIMESTAMP,
  LAST_LOGIN_AT         TIMESTAMP,
  AVATAR_COLOR          VARCHAR2(7),
  PREFERRED_LANG        VARCHAR2(2)     DEFAULT 'en' NOT NULL,
  CREATED_AT            TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
  CREATED_BY            NUMBER(19),
  UPDATED_AT            TIMESTAMP,
  UPDATED_BY            NUMBER(19),
  CONSTRAINT ATS_USERS_PK PRIMARY KEY (ID),
  CONSTRAINT ATS_USERS_USERNAME_UK UNIQUE (USERNAME),
  CONSTRAINT ATS_USERS_ORG_CK CHECK (ORGANIZATION IN ('PORT', 'VENDOR')),
  CONSTRAINT ATS_USERS_ACTIVE_CK CHECK (IS_ACTIVE IN (0, 1)),
  CONSTRAINT ATS_USERS_MUSTCHG_CK CHECK (MUST_CHANGE_PASSWORD IN (0, 1)),
  CONSTRAINT ATS_USERS_LANG_CK CHECK (PREFERRED_LANG IN ('en', 'ar'))
);

CREATE UNIQUE INDEX ATS_USERS_EMAIL_UX ON ATS_USERS (LOWER(EMAIL));

-- ---------------------------------------------------------------------------
-- Roles (a user may hold several)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE ATS_ROLES_SEQ START WITH 100 INCREMENT BY 1 NOCACHE;

CREATE TABLE ATS_ROLES (
  ID            NUMBER(19)      NOT NULL,
  CODE          VARCHAR2(40)    NOT NULL,
  NAME          VARCHAR2(80)    NOT NULL,
  NAME_AR       NVARCHAR2(80),
  DESCRIPTION   VARCHAR2(400),
  IS_SYSTEM     NUMBER(1)       DEFAULT 0 NOT NULL,
  SORT_ORDER    NUMBER(5)       DEFAULT 0 NOT NULL,
  CREATED_AT    TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT ATS_ROLES_PK PRIMARY KEY (ID),
  CONSTRAINT ATS_ROLES_CODE_UK UNIQUE (CODE)
);

CREATE TABLE ATS_USER_ROLES (
  USER_ID       NUMBER(19)      NOT NULL,
  ROLE_ID       NUMBER(19)      NOT NULL,
  ASSIGNED_AT   TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
  ASSIGNED_BY   NUMBER(19),
  CONSTRAINT ATS_USER_ROLES_PK PRIMARY KEY (USER_ID, ROLE_ID),
  CONSTRAINT ATS_USER_ROLES_USER_FK FOREIGN KEY (USER_ID) REFERENCES ATS_USERS (ID) ON DELETE CASCADE,
  CONSTRAINT ATS_USER_ROLES_ROLE_FK FOREIGN KEY (ROLE_ID) REFERENCES ATS_ROLES (ID) ON DELETE CASCADE
);

CREATE INDEX ATS_USER_ROLES_ROLE_IX ON ATS_USER_ROLES (ROLE_ID);

-- ---------------------------------------------------------------------------
-- Permission catalog + configurable role grants
--
-- A grant is (role, permission, condition). CONDITION_CODE = 'ALWAYS' means an
-- unconditional grant; any other code restricts it to a relationship with the
-- ticket/comment/attachment. Several rows for the same role+permission are
-- OR-ed. Workflow invariants (independent reviewer/tester, mandatory reasons)
-- are enforced in code and can never be bypassed by a grant.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE ATS_PERMISSIONS_SEQ START WITH 100 INCREMENT BY 1 NOCACHE;

CREATE TABLE ATS_PERMISSIONS (
  ID                   NUMBER(19)     NOT NULL,
  CODE                 VARCHAR2(60)   NOT NULL,
  CATEGORY             VARCHAR2(40)   NOT NULL,
  NAME                 VARCHAR2(120)  NOT NULL,
  DESCRIPTION          VARCHAR2(400),
  ALLOWED_CONDITIONS   VARCHAR2(400),
  SORT_ORDER           NUMBER(5)      DEFAULT 0 NOT NULL,
  CONSTRAINT ATS_PERMISSIONS_PK PRIMARY KEY (ID),
  CONSTRAINT ATS_PERMISSIONS_CODE_UK UNIQUE (CODE),
  CONSTRAINT ATS_PERMISSIONS_CAT_CK CHECK (CATEGORY IN (
    'TICKETS', 'ASSIGNMENTS', 'COLLABORATORS', 'CODE_REVIEW', 'TESTING', 'DEPLOYMENT',
    'PRODUCTION_VERIFICATION', 'COMMENTS', 'ATTACHMENTS', 'DASHBOARD',
    'USER_MANAGEMENT', 'MODULE_MANAGEMENT', 'ADMINISTRATION'))
);

CREATE TABLE ATS_ROLE_PERMISSIONS (
  ROLE_ID          NUMBER(19)     NOT NULL,
  PERMISSION_ID    NUMBER(19)     NOT NULL,
  CONDITION_CODE   VARCHAR2(30)   DEFAULT 'ALWAYS' NOT NULL,
  GRANTED_AT       TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  GRANTED_BY       NUMBER(19),
  CONSTRAINT ATS_ROLE_PERMS_PK PRIMARY KEY (ROLE_ID, PERMISSION_ID, CONDITION_CODE),
  CONSTRAINT ATS_ROLE_PERMS_ROLE_FK FOREIGN KEY (ROLE_ID) REFERENCES ATS_ROLES (ID) ON DELETE CASCADE,
  CONSTRAINT ATS_ROLE_PERMS_PERM_FK FOREIGN KEY (PERMISSION_ID) REFERENCES ATS_PERMISSIONS (ID) ON DELETE CASCADE,
  CONSTRAINT ATS_ROLE_PERMS_COND_CK CHECK (CONDITION_CODE IN (
    'ALWAYS', 'TICKET_CREATOR', 'CURRENT_ASSIGNEE', 'COLLABORATOR', 'ASSIGNED_REVIEWER',
    'ASSIGNED_TESTER', 'COMMENT_AUTHOR', 'ATTACHMENT_OWNER'))
);

CREATE INDEX ATS_ROLE_PERMS_PERM_IX ON ATS_ROLE_PERMISSIONS (PERMISSION_ID);

-- Every grant/revoke from the Permissions Center, for accountability.
CREATE SEQUENCE ATS_PERMISSION_AUDIT_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE ATS_PERMISSION_AUDIT (
  ID               NUMBER(19)     NOT NULL,
  CHANGE_SET_ID    VARCHAR2(36)   NOT NULL,
  ROLE_ID          NUMBER(19)     NOT NULL,
  PERMISSION_ID    NUMBER(19)     NOT NULL,
  CONDITION_CODE   VARCHAR2(30)   NOT NULL,
  ACTION           VARCHAR2(10)   NOT NULL,
  CHANGED_BY       NUMBER(19)     NOT NULL,
  CHANGED_AT       TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT ATS_PERM_AUDIT_PK PRIMARY KEY (ID),
  CONSTRAINT ATS_PERM_AUDIT_ACTION_CK CHECK (ACTION IN ('GRANT', 'REVOKE'))
);

CREATE INDEX ATS_PERM_AUDIT_SET_IX ON ATS_PERMISSION_AUDIT (CHANGE_SET_ID);

-- ---------------------------------------------------------------------------
-- Modules (admin-managed dropdown values)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE ATS_MODULES_SEQ START WITH 100 INCREMENT BY 1 NOCACHE;

CREATE TABLE ATS_MODULES (
  ID           NUMBER(19)      NOT NULL,
  NAME         VARCHAR2(80)    NOT NULL,
  NAME_AR      NVARCHAR2(80),
  IS_ACTIVE    NUMBER(1)       DEFAULT 1 NOT NULL,
  SORT_ORDER   NUMBER(5)       DEFAULT 0 NOT NULL,
  CREATED_AT   TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
  CREATED_BY   NUMBER(19),
  UPDATED_AT   TIMESTAMP,
  UPDATED_BY   NUMBER(19),
  CONSTRAINT ATS_MODULES_PK PRIMARY KEY (ID),
  CONSTRAINT ATS_MODULES_NAME_UK UNIQUE (NAME),
  CONSTRAINT ATS_MODULES_ACTIVE_CK CHECK (IS_ACTIVE IN (0, 1))
);

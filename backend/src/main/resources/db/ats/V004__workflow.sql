-- ============================================================================
-- ATS — V004: ticket workflow state (test outcome and block details)
-- ============================================================================

ALTER TABLE ATS_TICKETS ADD (
  TEST_RESULT   VARCHAR2(10),
  BLOCK_REASON  NVARCHAR2(2000),
  BLOCK_PATCH   VARCHAR2(100),
  BLOCKED_BY    NUMBER(19),
  BLOCKED_AT    TIMESTAMP
);

ALTER TABLE ATS_TICKETS ADD CONSTRAINT ATS_TICKETS_TEST_RESULT_CK CHECK (TEST_RESULT IN ('PASSED', 'FAILED'));

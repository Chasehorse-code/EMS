-- V11__enquiry_management.sql
-- Enquiry Management System: every website form (contact, enquiry pop-up, partner onboarding,
-- blueprint, careers, live-market requests, HSE shop) is stored here after the visitor verifies
-- their e-mail with a one-time code. Idempotent.

-- ============================================================
-- ROLE: ENQUIRY_MANAGER (the contact@ dashboard account)
-- ============================================================
ALTER TABLE app_role_assignments DROP CONSTRAINT IF EXISTS app_role_assignments_role_check;
ALTER TABLE app_role_assignments ADD CONSTRAINT app_role_assignments_role_check
    CHECK (role IN ('ADMIN','MANAGER','OPERATIONS','EMPLOYEE','CUSTOMER','PARTNER','FIELD_WORKER','ENQUIRY_MANAGER'));

-- ============================================================
-- ENQUIRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS enquiries (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reference         VARCHAR(20)  NOT NULL UNIQUE,            -- CH-ENQ-482913
    form_type         VARCHAR(40)  NOT NULL,
    source_page       VARCHAR(300),
    name              VARCHAR(160) NOT NULL,
    email             VARCHAR(320) NOT NULL,
    phone             VARCHAR(30),
    company           VARCHAR(200),
    city              VARCHAR(120),
    message           TEXT,
    details           TEXT         NOT NULL DEFAULT '{}',        -- all submitted fields as JSON
    email_verified_at TIMESTAMPTZ  NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW', 'IN_PROGRESS', 'CONTACTED', 'CLOSED', 'SPAM')),
    assigned_to       UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
    first_response_at TIMESTAMPTZ,
    client_ip_hash    VARCHAR(64),
    user_agent        VARCHAR(300),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_status  ON enquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_type    ON enquiries(form_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_email   ON enquiries(lower(email));

CREATE TABLE IF NOT EXISTS enquiry_events (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    enquiry_id  UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
    actor_name  VARCHAR(255),
    event_type  VARCHAR(30) NOT NULL,    -- CREATED, STATUS_CHANGED, ASSIGNED, NOTE
    old_value   VARCHAR(255),
    new_value   VARCHAR(255),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enquiry_events_enquiry ON enquiry_events(enquiry_id, created_at);

-- ============================================================
-- E-MAIL ONE-TIME CODES (hashed; never stored in clear text)
-- ============================================================
CREATE TABLE IF NOT EXISTS enquiry_email_otps (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email          VARCHAR(320) NOT NULL,
    code_hash      VARCHAR(64)  NOT NULL,
    attempts       INT          NOT NULL DEFAULT 0,
    expires_at     TIMESTAMPTZ  NOT NULL,
    consumed_at    TIMESTAMPTZ,
    client_ip_hash VARCHAR(64),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enquiry_otps_email ON enquiry_email_otps(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiry_otps_ip    ON enquiry_email_otps(client_ip_hash, created_at DESC);

-- ============================================================
-- No direct API (PostgREST) access: visitors' personal data is only reachable through the
-- backend's role-checked endpoints.
-- ============================================================
ALTER TABLE enquiries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry_email_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON enquiries, enquiry_events, enquiry_email_otps FROM anon, authenticated;

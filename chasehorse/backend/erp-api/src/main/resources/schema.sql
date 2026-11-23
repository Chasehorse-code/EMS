-- H2-compatible schema for embedded/test mode (no Flyway).
-- Mirrors V1__initial_schema.sql with H2 syntax (RANDOM_UUID, CLOB, no JSONB/INET).
-- Only used when SPRING_DATASOURCE_URL is not set.

CREATE TABLE IF NOT EXISTS states (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

MERGE INTO states (code, name) KEY (code) VALUES
    ('AP', 'Andhra Pradesh'),
    ('TG', 'Telangana'),
    ('KA', 'Karnataka'),
    ('TN', 'Tamil Nadu'),
    ('MH', 'Maharashtra'),
    ('DL', 'Delhi'),
    ('KL', 'Kerala'),
    ('GJ', 'Gujarat'),
    ('RJ', 'Rajasthan'),
    ('UP', 'Uttar Pradesh'),
    ('WB', 'West Bengal'),
    ('MP', 'Madhya Pradesh'),
    ('PB', 'Punjab'),
    ('HR', 'Haryana'),
    ('OR', 'Odisha'),
    ('BR', 'Bihar'),
    ('AS', 'Assam'),
    ('JH', 'Jharkhand'),
    ('CT', 'Chhattisgarh'),
    ('UT', 'Uttarakhand'),
    ('HP', 'Himachal Pradesh'),
    ('GA', 'Goa'),
    ('TR', 'Tripura'),
    ('ML', 'Meghalaya'),
    ('MN', 'Manipur'),
    ('NL', 'Nagaland'),
    ('MZ', 'Mizoram'),
    ('AR', 'Arunachal Pradesh'),
    ('SK', 'Sikkim'),
    ('JK', 'Jammu and Kashmir'),
    ('LA', 'Ladakh'),
    ('PY', 'Puducherry'),
    ('CH', 'Chandigarh'),
    ('AN', 'Andaman and Nicobar Islands'),
    ('DN', 'Dadra and Nagar Haveli and Daman and Diu'),
    ('LD', 'Lakshadweep')
;

CREATE TABLE IF NOT EXISTS app_profiles (
    id             UUID PRIMARY KEY,
    display_name   VARCHAR(255),
    email          VARCHAR(320),
    phone          VARCHAR(20),
    avatar_url     CLOB,
    region         VARCHAR(100),
    state_code     VARCHAR(10) REFERENCES states(code),
    manager_id     UUID,
    account_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (account_status IN ('PENDING','ACTIVE','SUSPENDED','BLOCKED','REJECTED')),
    display_id     VARCHAR(30),
    company_name   VARCHAR(255),
    zone_place     VARCHAR(120),
    zone_district  VARCHAR(120),
    zone_lat       DECIMAL(10,7),
    zone_lng       DECIMAL(10,7),
    current_lat    DECIMAL(10,7),
    current_lng    DECIMAL(10,7),
    location_updated_at TIMESTAMP WITH TIME ZONE,
    email_verified_at   TIMESTAMP WITH TIME ZONE,
    rejection_reason    CLOB,
    rejected_by         VARCHAR(255),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Transactional e-mail outbox (see V10__registration_zones_and_email_outbox.sql)
CREATE TABLE IF NOT EXISTS email_outbox (
    id              UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    dedupe_key      VARCHAR(255) NOT NULL UNIQUE,
    template        VARCHAR(60)  NOT NULL,
    from_address    VARCHAR(320) NOT NULL,
    to_addresses    CLOB         NOT NULL,
    cc_addresses    CLOB,
    subject         VARCHAR(500) NOT NULL,
    body_text       CLOB         NOT NULL,
    body_html       CLOB         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    attempts        INT          NOT NULL DEFAULT 0,
    last_error      CLOB,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at         TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS manager_areas (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    manager_id  UUID NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    state_code  VARCHAR(10) NOT NULL REFERENCES states(code) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES app_profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (manager_id, state_code)
);

CREATE TABLE IF NOT EXISTS app_role_assignments (
    id         UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    role       VARCHAR(50) NOT NULL,
    granted_by UUID REFERENCES app_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS checklist_templates (
    id         UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    category   VARCHAR(100) NOT NULL,
    created_by UUID REFERENCES app_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklist_items (
    id             UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    template_id    UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
    label          VARCHAR(500) NOT NULL,
    required       BOOLEAN NOT NULL DEFAULT false,
    requires_photo BOOLEAN NOT NULL DEFAULT false,
    sort_order     INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id                    UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    display_id            VARCHAR(30),
    created_by_role       VARCHAR(30),
    geofence_radius_meters INT NOT NULL DEFAULT 200,
    title                 VARCHAR(255) NOT NULL,
    description           CLOB,
    category              VARCHAR(100),
    status                VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    priority              VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    state_code            VARCHAR(10) REFERENCES states(code),
    created_by            UUID NOT NULL REFERENCES app_profiles(id),
    assigned_to           UUID REFERENCES app_profiles(id),
    customer_id           UUID REFERENCES app_profiles(id),
    checklist_template_id UUID REFERENCES checklist_templates(id),
    location_lat          DECIMAL(10,7),
    location_lng          DECIMAL(10,7),
    location_area         VARCHAR(255),
    location_address      CLOB,
    due_at                TIMESTAMP WITH TIME ZONE,
    reward_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency              CHAR(3) NOT NULL DEFAULT 'INR',
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to    ON tasks(assigned_to);

CREATE TABLE IF NOT EXISTS task_assignments (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES app_profiles(id),
    action      VARCHAR(50) NOT NULL,
    reason      VARCHAR(1000),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_checklist_results (
    id                UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES checklist_items(id),
    completed         BOOLEAN NOT NULL DEFAULT false,
    photo_attached    BOOLEAN NOT NULL DEFAULT false,
    completed_at      TIMESTAMP WITH TIME ZONE,
    UNIQUE(task_id, checklist_item_id)
);

CREATE TABLE IF NOT EXISTS task_evidence (
    id                  UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    task_id             UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    submitted_by        UUID NOT NULL REFERENCES app_profiles(id),
    storage_path        VARCHAR(1000) NOT NULL,
    file_name           VARCHAR(255),
    content_type        VARCHAR(100) NOT NULL,
    file_size_bytes     BIGINT,
    caption             CLOB,
    location_lat        DECIMAL(10,7),
    location_lng        DECIMAL(10,7),
    captured_at         TIMESTAMP WITH TIME ZONE,
    checklist_item_id   UUID REFERENCES checklist_items(id),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    verification_notes  CLOB,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidence_task ON task_evidence(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_verifications (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    evidence_id UUID NOT NULL REFERENCES task_evidence(id) ON DELETE CASCADE,
    status      VARCHAR(50) NOT NULL DEFAULT 'NOT_RUN',
    confidence  DECIMAL(4,3),
    summary     CLOB,
    checks      CLOB DEFAULT '[]',
    run_at      TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_approvals (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES task_evidence(id),
    reviewer_id UUID NOT NULL REFERENCES app_profiles(id),
    stage       VARCHAR(50) NOT NULL,
    decision    VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reason      CLOB,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
    id              UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES app_profiles(id),
    task_id         UUID REFERENCES tasks(id),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    entry_type      VARCHAR(50) NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'INR',
    description     CLOB NOT NULL,
    created_by      UUID REFERENCES app_profiles(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_user_created ON wallet_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    actor_id    UUID REFERENCES app_profiles(id),
    action      VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   UUID,
    metadata    CLOB NOT NULL DEFAULT '{}',
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES app_profiles(id),
    title       VARCHAR(255) NOT NULL,
    body        CLOB,
    type        VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   UUID,
    read        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_vehicles (
    id                  UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    registration_number VARCHAR(20)  NOT NULL UNIQUE,
    vehicle_type        VARCHAR(50)  NOT NULL,
    capacity_kg         NUMERIC(10,2),
    capacity_volume_m3  NUMERIC(10,2),
    make                VARCHAR(100),
    model               VARCHAR(100),
    model_year          INT,
    status              VARCHAR(50)  NOT NULL DEFAULT 'AVAILABLE',
    assigned_driver_id  UUID REFERENCES app_profiles(id),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_transport_plans (
    id                       UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    name                     VARCHAR(255) NOT NULL,
    description              CLOB,
    origin_area              VARCHAR(255) NOT NULL,
    destination_area         VARCHAR(255) NOT NULL,
    vehicle_type             VARCHAR(50),
    estimated_duration_hours NUMERIC(6,2),
    base_price               NUMERIC(12,2) NOT NULL,
    price_per_kg             NUMERIC(8,2),
    price_per_km             NUMERIC(8,2),
    currency                 CHAR(3)      NOT NULL DEFAULT 'INR',
    active                   BOOLEAN      NOT NULL DEFAULT true,
    created_by               UUID REFERENCES app_profiles(id),
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_bookings (
    id                  UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    booking_ref         VARCHAR(20) NOT NULL UNIQUE,
    customer_id         UUID NOT NULL REFERENCES app_profiles(id),
    transport_plan_id   UUID REFERENCES tms_transport_plans(id),
    vehicle_id          UUID REFERENCES tms_vehicles(id),
    driver_id           UUID REFERENCES app_profiles(id),
    origin_address      CLOB NOT NULL,
    origin_lat          DECIMAL(10,7),
    origin_lng          DECIMAL(10,7),
    destination_address CLOB NOT NULL,
    destination_lat     DECIMAL(10,7),
    destination_lng     DECIMAL(10,7),
    cargo_description   CLOB,
    cargo_weight_kg     NUMERIC(10,2),
    pickup_date         TIMESTAMP WITH TIME ZONE,
    delivery_date       TIMESTAMP WITH TIME ZONE,
    status              VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    total_price         NUMERIC(12,2),
    price_breakdown     CLOB DEFAULT '{}',
    payment_status      VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    notes               CLOB,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_tracking_events (
    id                   UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    booking_id           UUID NOT NULL REFERENCES tms_bookings(id) ON DELETE CASCADE,
    status               VARCHAR(50) NOT NULL,
    location_description VARCHAR(255),
    location_lat         DECIMAL(10,7),
    location_lng         DECIMAL(10,7),
    notes                CLOB,
    recorded_by          UUID REFERENCES app_profiles(id),
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_feedback (
    id                      UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    task_id                 UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    employee_id             UUID NOT NULL REFERENCES app_profiles(id),
    customer_id             UUID NOT NULL REFERENCES app_profiles(id),
    overall_rating          INT NOT NULL,
    quality_rating          INT NOT NULL DEFAULT 5,
    punctuality_rating      INT NOT NULL DEFAULT 5,
    communication_rating    INT NOT NULL DEFAULT 5,
    evidence_clarity_rating INT NOT NULL DEFAULT 5,
    comment                 CLOB,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS support_tickets (
    id                UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    display_id        VARCHAR(30),
    ticket_number     VARCHAR(30) UNIQUE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES app_profiles(id),
    assigned_to       UUID REFERENCES app_profiles(id),
    related_task_id   UUID REFERENCES tasks(id) ON DELETE SET NULL,
    subject           VARCHAR(255) NOT NULL,
    category          VARCHAR(100) NOT NULL DEFAULT 'OPERATIONS',
    urgency           VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    status            VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    region            VARCHAR(100),
    state_code        VARCHAR(10) REFERENCES states(code),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at       TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
    id            UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_id     UUID NOT NULL REFERENCES app_profiles(id),
    author_name   VARCHAR(255),
    message       CLOB NOT NULL,
    is_internal   BOOLEAN NOT NULL DEFAULT false,
    attachments   CLOB DEFAULT '[]',
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_ticket_events (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL REFERENCES app_profiles(id),
    event_type  VARCHAR(50) NOT NULL,
    old_value   VARCHAR(255),
    new_value   VARCHAR(255),
    notes       CLOB,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PARTNERS & REGISTRATION APPROVAL TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_profiles (
    id               UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    reference_id     VARCHAR(50) UNIQUE NOT NULL,
    user_id          UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
    partner_type     VARCHAR(50) NOT NULL,
    status           VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    contact_name     VARCHAR(255) NOT NULL,
    company_name     VARCHAR(255),
    email            VARCHAR(320) NOT NULL,
    phone            VARCHAR(30) NOT NULL,
    masked_gst       VARCHAR(30),
    submitted_data   CLOB NOT NULL DEFAULT '{}',
    rejection_reason CLOB,
    reviewed_by      UUID REFERENCES app_profiles(id),
    reviewed_at      TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partner_status ON partner_profiles(status);
CREATE INDEX IF NOT EXISTS idx_partner_type   ON partner_profiles(partner_type);
CREATE INDEX IF NOT EXISTS idx_partner_email  ON partner_profiles(email);
CREATE INDEX IF NOT EXISTS idx_partner_ref    ON partner_profiles(reference_id);

CREATE TABLE IF NOT EXISTS partner_approvals (
    id              UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    partner_id      UUID NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
    actor_id        UUID REFERENCES app_profiles(id),
    action          VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    new_status      VARCHAR(50) NOT NULL,
    reason          CLOB,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partner_appr_partner ON partner_approvals(partner_id, created_at DESC);

-- =============================================================================
-- TRAQO TRUCK / PARCEL TRACKING TRIPS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tracking_trips (
    id                   UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    traqo_trip_id        VARCHAR(100),
    invoice_number       VARCHAR(100),
    lr_number            VARCHAR(100),
    truck_number         VARCHAR(50) NOT NULL,
    driver_phone         VARCHAR(30) NOT NULL,
    status               VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
    origin_name          VARCHAR(255),
    origin_lat           DECIMAL(10,7),
    origin_lng           DECIMAL(10,7),
    destination_name     VARCHAR(255),
    destination_lat      DECIMAL(10,7),
    destination_lng      DECIMAL(10,7),
    eta_timestamp        TIMESTAMP WITH TIME ZONE,
    consent_status       VARCHAR(50) DEFAULT 'PENDING',
    consent_count        INT DEFAULT 0,
    created_by           UUID REFERENCES app_profiles(id),
    assigned_manager_id  UUID REFERENCES app_profiles(id),
    metadata             CLOB DEFAULT '{}',
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_status  ON tracking_trips(status);
CREATE INDEX IF NOT EXISTS idx_tracking_traqo   ON tracking_trips(traqo_trip_id);
CREATE INDEX IF NOT EXISTS idx_tracking_invoice ON tracking_trips(invoice_number);
CREATE INDEX IF NOT EXISTS idx_tracking_truck   ON tracking_trips(truck_number);


-- ============================================================
-- Enquiry Management System (see V11__enquiry_management.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS enquiries (
    id                UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    reference         VARCHAR(20)  NOT NULL UNIQUE,
    form_type         VARCHAR(40)  NOT NULL,
    source_page       VARCHAR(300),
    name              VARCHAR(160) NOT NULL,
    email             VARCHAR(320) NOT NULL,
    phone             VARCHAR(30),
    company           VARCHAR(200),
    city              VARCHAR(120),
    message           CLOB,
    details           VARCHAR(200000) NOT NULL DEFAULT '{}',
    email_verified_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW', 'IN_PROGRESS', 'CONTACTED', 'CLOSED', 'SPAM')),
    assigned_to       UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
    first_response_at TIMESTAMP WITH TIME ZONE,
    client_ip_hash    VARCHAR(64),
    user_agent        VARCHAR(300),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enquiry_events (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    enquiry_id  UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
    actor_name  VARCHAR(255),
    event_type  VARCHAR(30) NOT NULL,
    old_value   VARCHAR(255),
    new_value   VARCHAR(255),
    note        CLOB,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enquiry_email_otps (
    id             UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    email          VARCHAR(320) NOT NULL,
    code_hash      VARCHAR(64)  NOT NULL,
    attempts       INT          NOT NULL DEFAULT 0,
    expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at    TIMESTAMP WITH TIME ZONE,
    client_ip_hash VARCHAR(64),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

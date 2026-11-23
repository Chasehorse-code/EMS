-- V9__partners_and_tracking.sql
-- ChaseHorse EMS — Partner Approvals and Traqo Tracking Schema

CREATE TABLE IF NOT EXISTS partner_profiles (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_id     VARCHAR(50) UNIQUE NOT NULL,
    user_id          UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
    partner_type     VARCHAR(50) NOT NULL,
    status           VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    contact_name     VARCHAR(255) NOT NULL,
    company_name     VARCHAR(255),
    email            VARCHAR(320) NOT NULL,
    phone            VARCHAR(30) NOT NULL,
    masked_gst       VARCHAR(30),
    submitted_data   TEXT NOT NULL DEFAULT '{}',
    rejection_reason TEXT,
    reviewed_by      UUID REFERENCES app_profiles(id),
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_status ON partner_profiles(status);
CREATE INDEX IF NOT EXISTS idx_partner_type   ON partner_profiles(partner_type);
CREATE INDEX IF NOT EXISTS idx_partner_email  ON partner_profiles(email);
CREATE INDEX IF NOT EXISTS idx_partner_ref    ON partner_profiles(reference_id);

CREATE TABLE IF NOT EXISTS partner_approvals (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id      UUID NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
    actor_id        UUID REFERENCES app_profiles(id),
    action          VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    new_status      VARCHAR(50) NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_appr_partner ON partner_approvals(partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tracking_trips (
    id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    eta_timestamp        TIMESTAMPTZ,
    consent_status       VARCHAR(50) DEFAULT 'PENDING',
    consent_count        INT DEFAULT 0,
    created_by           UUID REFERENCES app_profiles(id),
    assigned_manager_id  UUID REFERENCES app_profiles(id),
    metadata             TEXT DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_status  ON tracking_trips(status);
CREATE INDEX IF NOT EXISTS idx_tracking_traqo   ON tracking_trips(traqo_trip_id);
CREATE INDEX IF NOT EXISTS idx_tracking_invoice ON tracking_trips(invoice_number);


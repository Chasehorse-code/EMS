-- V4__support_tickets.sql
-- Enterprise Support Ticket System with Append-Only Audit History & RLS Governance

CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS support_tickets (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number     VARCHAR(30) UNIQUE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES app_profiles(id),
    assigned_to       UUID REFERENCES app_profiles(id),
    related_task_id   UUID REFERENCES tasks(id) ON DELETE SET NULL,
    subject           VARCHAR(255) NOT NULL,
    category          VARCHAR(100) NOT NULL DEFAULT 'OPERATIONS',
    urgency           VARCHAR(30) NOT NULL DEFAULT 'NORMAL'
        CHECK (urgency IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    status            VARCHAR(50) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED')),
    region            VARCHAR(100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_region ON support_tickets(region);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_id     UUID NOT NULL REFERENCES app_profiles(id),
    author_name   VARCHAR(255),
    message       TEXT NOT NULL,
    is_internal   BOOLEAN NOT NULL DEFAULT false,
    attachments   JSONB DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON support_ticket_comments(ticket_id, created_at ASC);

-- Append-only audit history of every status, priority, and assignment change
CREATE TABLE IF NOT EXISTS support_ticket_events (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL REFERENCES app_profiles(id),
    event_type  VARCHAR(50) NOT NULL,
    old_value   VARCHAR(255),
    new_value   VARCHAR(255),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON support_ticket_events(ticket_id, created_at ASC);

-- Enable Row Level Security
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_events ENABLE ROW LEVEL SECURITY;

-- Append-only rule for support_ticket_events (no updates, no deletes)
CREATE OR REPLACE RULE no_update_support_ticket_events AS ON UPDATE TO support_ticket_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_support_ticket_events AS ON DELETE TO support_ticket_events DO INSTEAD NOTHING;

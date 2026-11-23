-- V10__registration_zones_and_email_outbox.sql
-- 1. Worker operational zone (town, district, coordinates) and customer company name
-- 2. Real e-mail verification (OTP) — sign-up no longer auto-confirms e-mail addresses
-- 3. BLOCKED account status (suspend / block / reinstate by zone manager or admin)
-- 4. Transactional e-mail outbox (task / ticket notifications sent through Zoho SMTP)
--
-- Supabase-only: references auth.users. Idempotent, safe to re-run.

-- ============================================================
-- 1. PROFILE COLUMNS
-- ============================================================
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS company_name      VARCHAR(255);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS zone_place        VARCHAR(120);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS zone_district     VARCHAR(120);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS zone_lat          DECIMAL(10,7);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS zone_lng          DECIMAL(10,7);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
-- Already present on the live database (added outside migrations); declared here so a fresh
-- database matches what EmployeeController expects.
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS rejected_by       VARCHAR(255);

-- ============================================================
-- 3. ACCOUNT STATUS: add BLOCKED
-- ============================================================
ALTER TABLE app_profiles DROP CONSTRAINT IF EXISTS app_profiles_account_status_check;
ALTER TABLE app_profiles ADD CONSTRAINT app_profiles_account_status_check
    CHECK (account_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'REJECTED'));

-- ============================================================
-- 2. E-MAIL VERIFICATION
-- ============================================================
-- Existing accounts were auto-confirmed at sign-up; carry that over.
UPDATE app_profiles p
SET email_verified_at = u.email_confirmed_at
FROM auth.users u
WHERE u.id = p.id AND p.email_verified_at IS NULL AND u.email_confirmed_at IS NOT NULL;

-- New sign-ups. Roles come only from a fixed allow-list (customer or field worker); admin,
-- manager and operations roles are never self-assignable. The e-mail stays unconfirmed until
-- the user enters the OTP that Supabase sends (via the Zoho SMTP configured in Supabase).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    meta            JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    v_is_customer   BOOLEAN := UPPER(COALESCE(meta->>'account_type', '')) = 'CUSTOMER';
    v_display_name  TEXT;
    v_company       TEXT := NULLIF(LEFT(BTRIM(meta->>'company_name'), 255), '');
    v_phone         TEXT := NULLIF(LEFT(BTRIM(meta->>'phone'), 20), '');
    v_state_code    TEXT := UPPER(NULLIF(BTRIM(meta->>'state_code'), ''));
    v_region        TEXT;
    v_zone_place    TEXT := NULLIF(LEFT(BTRIM(meta->>'zone_place'), 120), '');
    v_zone_district TEXT := NULLIF(LEFT(BTRIM(meta->>'zone_district'), 120), '');
    v_zone_lat      DECIMAL(10,7);
    v_zone_lng      DECIMAL(10,7);
    v_seq           BIGINT;
BEGIN
    v_display_name := LEFT(COALESCE(
        NULLIF(BTRIM(meta->>'full_name'), ''),
        NULLIF(BTRIM(meta->>'name'), ''),
        v_company,
        split_part(NEW.email, '@', 1)
    ), 255);

    -- Only accept a state that exists; never default a worker into a zone they didn't pick.
    IF v_state_code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM states WHERE code = v_state_code) THEN
        v_state_code := NULL;
    END IF;
    SELECT name INTO v_region FROM states WHERE code = v_state_code;

    -- Zone coordinates: numeric and inside India's bounding box, otherwise ignored.
    IF meta->>'zone_lat' ~ '^-?[0-9]{1,3}(\.[0-9]+)?$' AND meta->>'zone_lng' ~ '^-?[0-9]{1,3}(\.[0-9]+)?$' THEN
        v_zone_lat := (meta->>'zone_lat')::DECIMAL(10,7);
        v_zone_lng := (meta->>'zone_lng')::DECIMAL(10,7);
        IF v_zone_lat NOT BETWEEN 6 AND 38 OR v_zone_lng NOT BETWEEN 68 AND 98 THEN
            v_zone_lat := NULL;
            v_zone_lng := NULL;
        END IF;
    END IF;

    -- EMP display ID (same scheme as before)
    UPDATE id_counters SET current_value = current_value + 1, updated_at = now()
    WHERE prefix = 'EMP' RETURNING current_value INTO v_seq;
    IF v_seq IS NULL THEN
        INSERT INTO id_counters (prefix, current_value, updated_at) VALUES ('EMP', 1, now())
        ON CONFLICT (prefix) DO UPDATE SET current_value = id_counters.current_value + 1, updated_at = now()
        RETURNING current_value INTO v_seq;
    END IF;

    INSERT INTO app_profiles (
        id, display_id, display_name, company_name, email, phone, region, state_code,
        zone_place, zone_district, zone_lat, zone_lng, email_verified_at, account_status,
        created_at, updated_at
    ) VALUES (
        NEW.id, 'EMP' || LPAD(v_seq::TEXT, 3, '0'), v_display_name,
        CASE WHEN v_is_customer THEN v_company END,
        NEW.email, v_phone, v_region, v_state_code,
        CASE WHEN v_is_customer THEN NULL ELSE v_zone_place END,
        CASE WHEN v_is_customer THEN NULL ELSE v_zone_district END,
        CASE WHEN v_is_customer THEN NULL ELSE v_zone_lat END,
        CASE WHEN v_is_customer THEN NULL ELSE v_zone_lng END,
        NEW.email_confirmed_at,
        -- Customers only need a verified e-mail; field workers also need manager/admin approval.
        CASE WHEN v_is_customer THEN 'ACTIVE' ELSE 'PENDING' END,
        now(), now()
    )
    ON CONFLICT (id) DO NOTHING;

    IF v_is_customer THEN
        INSERT INTO app_role_assignments (user_id, role) VALUES (NEW.id, 'CUSTOMER')
        ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
        INSERT INTO app_role_assignments (user_id, role) VALUES (NEW.id, 'EMPLOYEE')
        ON CONFLICT (user_id, role) DO NOTHING;
        INSERT INTO app_role_assignments (user_id, role) VALUES (NEW.id, 'FIELD_WORKER')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Mirror e-mail confirmation (OTP verified) onto the profile so the approval queue can show it.
CREATE OR REPLACE FUNCTION public.handle_auth_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.email_confirmed_at IS DISTINCT FROM OLD.email_confirmed_at THEN
        UPDATE app_profiles SET email_verified_at = NEW.email_confirmed_at, updated_at = now()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_email_confirmed();

-- ============================================================
-- 4. E-MAIL OUTBOX
-- ============================================================
-- Rows are written in the same transaction as the business change and sent afterwards by
-- the API's EmailDispatcher with retries. dedupe_key makes every notification send at most once.
CREATE TABLE IF NOT EXISTS email_outbox (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dedupe_key      VARCHAR(255) NOT NULL UNIQUE,
    template        VARCHAR(60)  NOT NULL,
    from_address    VARCHAR(320) NOT NULL,
    to_addresses    TEXT         NOT NULL,
    cc_addresses    TEXT,
    subject         VARCHAR(500) NOT NULL,
    body_text       TEXT         NOT NULL,
    body_html       TEXT         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts        INT          NOT NULL DEFAULT 0,
    last_error      TEXT,
    next_attempt_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_due ON email_outbox(status, next_attempt_at);

-- Holds personal data: no API (PostgREST) access at all. Only the backend's database role reads it.
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_outbox FROM anon, authenticated;

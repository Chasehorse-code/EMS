-- V7__custom_display_identifiers.sql
-- Concurrency-safe, database-generated display identifiers for Tasks, Support Tickets, and Employees.
-- Format specifications:
--   Tasks: <creator letter>OFW<3-digit sequence> (e.g. AOFW001, COFW001, OOFW001, MOFW001)
--   Support Tickets: ST<3-digit sequence> (e.g. ST001, ST002)
--   Employees: EMP<3-digit sequence> (e.g. EMP001, EMP002)

-- 1. Counter table with row-locked atomic increment
CREATE TABLE IF NOT EXISTS id_counters (
    prefix          VARCHAR(20) PRIMARY KEY,
    current_value   BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS display_id VARCHAR(30);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(50);

-- 3. Add columns to support_tickets
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS display_id VARCHAR(30);

-- 4. Add columns to app_profiles
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS display_id VARCHAR(30);

-- 5. Backfill existing app_profiles with EMP001...
DO $$
DECLARE
    r RECORD;
    counter INT := 0;
BEGIN
    FOR r IN SELECT id FROM app_profiles ORDER BY created_at ASC, id ASC LOOP
        counter := counter + 1;
        UPDATE app_profiles
        SET display_id = 'EMP' || LPAD(counter::TEXT, 3, '0')
        WHERE id = r.id AND display_id IS NULL;
    END LOOP;
    INSERT INTO id_counters (prefix, current_value)
    VALUES ('EMP', counter)
    ON CONFLICT (prefix) DO UPDATE SET current_value = GREATEST(id_counters.current_value, EXCLUDED.current_value);
END $$;

-- 6. Backfill existing support_tickets with ST001...
DO $$
DECLARE
    r RECORD;
    counter INT := 0;
BEGIN
    FOR r IN SELECT id FROM support_tickets ORDER BY created_at ASC, id ASC LOOP
        counter := counter + 1;
        UPDATE support_tickets
        SET display_id = 'ST' || LPAD(counter::TEXT, 3, '0')
        WHERE id = r.id AND display_id IS NULL;
    END LOOP;
    INSERT INTO id_counters (prefix, current_value)
    VALUES ('ST', counter)
    ON CONFLICT (prefix) DO UPDATE SET current_value = GREATEST(id_counters.current_value, EXCLUDED.current_value);
END $$;

-- 7. Backfill existing tasks with <prefix>OFW001...
DO $$
DECLARE
    r RECORD;
    c_role VARCHAR(50);
    pfx VARCHAR(10);
    seq_val BIGINT;
BEGIN
    -- Initialize counter prefixes if not present
    INSERT INTO id_counters (prefix, current_value) VALUES ('AOFW', 0) ON CONFLICT (prefix) DO NOTHING;
    INSERT INTO id_counters (prefix, current_value) VALUES ('COFW', 0) ON CONFLICT (prefix) DO NOTHING;
    INSERT INTO id_counters (prefix, current_value) VALUES ('OOFW', 0) ON CONFLICT (prefix) DO NOTHING;
    INSERT INTO id_counters (prefix, current_value) VALUES ('MOFW', 0) ON CONFLICT (prefix) DO NOTHING;

    FOR r IN SELECT id, created_by FROM tasks ORDER BY created_at ASC, id ASC LOOP
        -- Determine creator role
        SELECT role INTO c_role
        FROM app_role_assignments
        WHERE user_id = r.created_by
        ORDER BY CASE
            WHEN role = 'ADMIN' THEN 1
            WHEN role = 'OPERATIONS' THEN 2
            WHEN role = 'MANAGER' THEN 3
            WHEN role = 'CUSTOMER' THEN 4
            ELSE 5
        END LIMIT 1;

        IF c_role IS NULL THEN
            c_role := 'ADMIN';
        END IF;

        IF c_role = 'ADMIN' THEN
            pfx := 'AOFW';
        ELSIF c_role = 'OPERATIONS' THEN
            pfx := 'OOFW';
        ELSIF c_role = 'MANAGER' THEN
            pfx := 'MOFW';
        ELSIF c_role = 'CUSTOMER' THEN
            pfx := 'COFW';
        ELSE
            pfx := 'AOFW';
        END IF;

        -- Increment counter
        UPDATE id_counters
        SET current_value = current_value + 1, updated_at = now()
        WHERE prefix = pfx
        RETURNING current_value INTO seq_val;

        UPDATE tasks
        SET display_id = pfx || LPAD(seq_val::TEXT, 3, '0'),
            created_by_role = c_role
        WHERE id = r.id AND display_id IS NULL;
    END LOOP;
END $$;

-- 8. Add unique indices & format check constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_display_id ON tasks(display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_display_id ON support_tickets(display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_profiles_display_id ON app_profiles(display_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_display_id') THEN
        ALTER TABLE tasks ADD CONSTRAINT chk_tasks_display_id CHECK (display_id ~ '^[A-Z0-9_-]+$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_support_tickets_display_id') THEN
        ALTER TABLE support_tickets ADD CONSTRAINT chk_support_tickets_display_id CHECK (display_id ~ '^ST[0-9]+$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_app_profiles_display_id') THEN
        ALTER TABLE app_profiles ADD CONSTRAINT chk_app_profiles_display_id CHECK (display_id ~ '^EMP[0-9]+$');
    END IF;
END $$;

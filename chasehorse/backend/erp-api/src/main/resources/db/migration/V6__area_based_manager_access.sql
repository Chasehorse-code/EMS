-- V6__area_based_manager_access.sql
-- Area (State) Based Access Control for Managers, Field Workers, Tasks, Wallets, and Support Tickets

-- ============================================================
-- 1. REFERENCE TABLE: STATES (INDIA STATES & UTs)
-- ============================================================

CREATE TABLE IF NOT EXISTS states (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

INSERT INTO states (code, name) VALUES
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
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- 2. ADD STATE_CODE TO ENTITIES
-- ============================================================

ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS state_code VARCHAR(10) REFERENCES states(code);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS state_code VARCHAR(10) REFERENCES states(code);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS state_code VARCHAR(10) REFERENCES states(code);

CREATE INDEX IF NOT EXISTS idx_app_profiles_state ON app_profiles(state_code);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state_code);
CREATE INDEX IF NOT EXISTS idx_support_tickets_state ON support_tickets(state_code);

-- ============================================================
-- 3. MANAGER AREAS (MAPPING TABLE)
-- ============================================================

CREATE TABLE IF NOT EXISTS manager_areas (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manager_id  UUID NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    state_code  VARCHAR(10) NOT NULL REFERENCES states(code) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES app_profiles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_manager_area_pair UNIQUE (manager_id, state_code),
    CONSTRAINT uq_manager_single_state UNIQUE (manager_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_areas_manager ON manager_areas(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_areas_state ON manager_areas(state_code);

-- ============================================================
-- 4. HELPER FUNCTIONS FOR SECURITY ENFORCEMENT
-- ============================================================

-- Function: Does actor cover the given state? (Admins cover all; Managers cover assigned state)
CREATE OR REPLACE FUNCTION manager_covers_state(p_actor_id UUID, p_state_code VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_actor_id IS NULL OR p_state_code IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admins cover all states
    IF EXISTS (
        SELECT 1 FROM app_role_assignments
        WHERE user_id = p_actor_id AND role = 'ADMIN'
    ) THEN
        RETURN TRUE;
    END IF;

    -- Manager check against manager_areas
    RETURN EXISTS (
        SELECT 1 FROM manager_areas
        WHERE manager_id = p_actor_id AND state_code = p_state_code
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Can actor manage the target employee?
-- Admins can manage anyone.
-- Managers can ONLY manage active/pending field workers in their assigned state.
-- Managers can NEVER manage admins, other managers, operations, or workers in other states.
CREATE OR REPLACE FUNCTION can_manage_employee(p_actor_id UUID, p_employee_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_target_state VARCHAR;
BEGIN
    IF p_actor_id IS NULL OR p_employee_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Prevent self-management / privilege escalation
    IF p_actor_id = p_employee_id THEN
        RETURN FALSE;
    END IF;

    -- Admin can manage any employee
    IF EXISTS (
        SELECT 1 FROM app_role_assignments
        WHERE user_id = p_actor_id AND role = 'ADMIN'
    ) THEN
        RETURN TRUE;
    END IF;

    -- Target must NOT be an Admin, Manager, or Operations personnel
    IF EXISTS (
        SELECT 1 FROM app_role_assignments
        WHERE user_id = p_employee_id AND role IN ('ADMIN', 'MANAGER', 'OPERATIONS')
    ) THEN
        RETURN FALSE;
    END IF;

    -- Target must have a state_code matching manager's assigned state
    SELECT state_code INTO v_target_state FROM app_profiles WHERE id = p_employee_id;
    IF v_target_state IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN manager_covers_state(p_actor_id, v_target_state);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Can actor manage the target task?
CREATE OR REPLACE FUNCTION can_manage_task(p_actor_id UUID, p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_task_state VARCHAR;
BEGIN
    IF p_actor_id IS NULL OR p_task_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM app_role_assignments
        WHERE user_id = p_actor_id AND role = 'ADMIN'
    ) THEN
        RETURN TRUE;
    END IF;

    SELECT state_code INTO v_task_state FROM tasks WHERE id = p_task_id;
    IF v_task_state IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN manager_covers_state(p_actor_id, v_task_state);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Can actor manage the target support ticket?
CREATE OR REPLACE FUNCTION can_manage_ticket(p_actor_id UUID, p_ticket_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_ticket_state VARCHAR;
BEGIN
    IF p_actor_id IS NULL OR p_ticket_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM app_role_assignments
        WHERE user_id = p_actor_id AND role = 'ADMIN'
    ) THEN
        RETURN TRUE;
    END IF;

    SELECT state_code INTO v_ticket_state FROM support_tickets WHERE id = p_ticket_id;
    IF v_ticket_state IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN manager_covers_state(p_actor_id, v_ticket_state);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 5. SECURE DATABASE PROCEDURES (CALLABLE BY DIRECT SQL & API)
-- ============================================================

-- Procedure: Decide worker account status (Approve, Reject, Suspend)
CREATE OR REPLACE FUNCTION decide_account(
    p_actor_id UUID,
    p_employee_id UUID,
    p_decision VARCHAR,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_emp_state VARCHAR;
BEGIN
    IF NOT can_manage_employee(p_actor_id, p_employee_id) THEN
        RAISE EXCEPTION 'Access denied: You are not authorized to decide account status for this employee or state';
    END IF;

    IF p_decision IN ('REJECTED', 'SUSPENDED') AND (p_reason IS NULL OR trim(p_reason) = '') THEN
        RAISE EXCEPTION 'A mandatory justification reason must be provided when rejecting or suspending an employee account';
    END IF;

    SELECT state_code INTO v_emp_state FROM app_profiles WHERE id = p_employee_id;

    UPDATE app_profiles
    SET account_status = p_decision,
        updated_at = now()
    WHERE id = p_employee_id;

    INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id,
        'EMPLOYEE_' || p_decision,
        'app_profiles',
        p_employee_id,
        jsonb_build_object(
            'decision', p_decision,
            'reason', p_reason,
            'state_code', v_emp_state
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Procedure: Assign task to worker with strict state parity
CREATE OR REPLACE FUNCTION assign_task_to_worker(
    p_actor_id UUID,
    p_task_id UUID,
    p_employee_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_task_state VARCHAR;
    v_worker_state VARCHAR;
    v_worker_status VARCHAR;
BEGIN
    IF NOT can_manage_task(p_actor_id, p_task_id) THEN
        RAISE EXCEPTION 'Access denied: You are not authorized to assign tasks in this area/state';
    END IF;

    IF NOT can_manage_employee(p_actor_id, p_employee_id) THEN
        RAISE EXCEPTION 'Access denied: Target worker is outside your assigned area or unauthorized';
    END IF;

    SELECT state_code INTO v_task_state FROM tasks WHERE id = p_task_id;
    SELECT state_code, account_status INTO v_worker_state, v_worker_status FROM app_profiles WHERE id = p_employee_id;

    IF v_task_state IS DISTINCT FROM v_worker_state THEN
        RAISE EXCEPTION 'Cross-state assignment forbidden: Task state (%) does not match worker state (%)', v_task_state, v_worker_state;
    END IF;

    IF v_worker_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Cannot assign task: Field worker account status is % (must be ACTIVE)', v_worker_status;
    END IF;

    UPDATE tasks
    SET assigned_to = p_employee_id,
        status = 'ASSIGNED',
        updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO task_assignments (task_id, employee_id, action)
    VALUES (p_task_id, p_employee_id, 'ACCEPTED');

    INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id,
        'TASK_ASSIGNED_BY_MANAGER',
        'tasks',
        p_task_id,
        jsonb_build_object(
            'assigned_to', p_employee_id,
            'state_code', v_task_state
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. SEED AND BACKFILL DEFAULT DEMO STATES
-- ============================================================

-- Backfill existing profiles and tasks with 'AP' (Andhra Pradesh) as default cluster
UPDATE app_profiles SET state_code = 'AP' WHERE state_code IS NULL;
UPDATE tasks SET state_code = 'AP' WHERE state_code IS NULL;
UPDATE support_tickets SET state_code = 'AP' WHERE state_code IS NULL;

-- Assign Andhra Pradesh area to existing manager profiles
INSERT INTO manager_areas (manager_id, state_code)
SELECT id, 'AP'
FROM app_profiles p
WHERE EXISTS (
    SELECT 1 FROM app_role_assignments r
    WHERE r.user_id = p.id AND r.role IN ('MANAGER', 'OPERATIONS')
)
ON CONFLICT (manager_id) DO NOTHING;

-- V12: multi-zone operations managers, and task decline / drop with reasons.

-- 1. Operations managers may now hold one or many zones (states), as decided by an admin.
--    The (manager_id, state_code) pair stays unique; the one-zone-per-manager limit is removed.
ALTER TABLE manager_areas DROP CONSTRAINT IF EXISTS uq_manager_single_state;

-- 2. Task assignment history: workers can drop a task part-way, and every decline / drop /
--    re-assignment keeps its reason.
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE task_assignments DROP CONSTRAINT IF EXISTS task_assignments_action_check;
ALTER TABLE task_assignments ADD CONSTRAINT task_assignments_action_check
    CHECK (action IN ('OFFERED', 'ACCEPTED', 'REJECTED', 'REVOKED', 'DROPPED'));
CREATE INDEX IF NOT EXISTS idx_task_assignments_employee ON task_assignments(employee_id, created_at DESC);

-- V5__manager_assignment_and_feedback.sql
-- Manager Hierarchy Assignment & Customer Field Task Feedback

-- 1. Add manager hierarchy, skills, and area fields to app_profiles
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES app_profiles(id);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS location_consent BOOLEAN DEFAULT false;
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10,7);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS current_lng DECIMAL(10,7);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_profiles_manager ON app_profiles(manager_id);

-- 2. Customer Feedback on Completed & Approved Field Tasks
CREATE TABLE IF NOT EXISTS task_feedback (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id                 UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    employee_id             UUID NOT NULL REFERENCES app_profiles(id),
    customer_id             UUID NOT NULL REFERENCES app_profiles(id),
    overall_rating          INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    quality_rating          INT NOT NULL DEFAULT 5 CHECK (quality_rating BETWEEN 1 AND 5),
    punctuality_rating      INT NOT NULL DEFAULT 5 CHECK (punctuality_rating BETWEEN 1 AND 5),
    communication_rating    INT NOT NULL DEFAULT 5 CHECK (communication_rating BETWEEN 1 AND 5),
    evidence_clarity_rating INT NOT NULL DEFAULT 5 CHECK (evidence_clarity_rating BETWEEN 1 AND 5),
    comment                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_feedback_employee ON task_feedback(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_feedback_customer ON task_feedback(customer_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE task_feedback ENABLE ROW LEVEL SECURITY;

-- Customers can view feedback they authored
CREATE POLICY customer_view_own_feedback ON task_feedback
    FOR SELECT USING (customer_id = auth.uid());

-- Workers can view feedback given to them
CREATE POLICY worker_view_assigned_feedback ON task_feedback
    FOR SELECT USING (employee_id = auth.uid());

-- Managers and Admins can view all feedback
CREATE POLICY staff_view_all_feedback ON task_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_role_assignments
            WHERE user_id = auth.uid()
            AND role IN ('ADMIN', 'MANAGER', 'OPERATIONS')
        )
    );

-- Customers can insert feedback only for their own approved tasks
CREATE POLICY customer_insert_task_feedback ON task_feedback
    FOR INSERT WITH CHECK (
        customer_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_feedback.task_id
            AND tasks.customer_id = auth.uid()
            AND tasks.status = 'APPROVED'
        )
    );

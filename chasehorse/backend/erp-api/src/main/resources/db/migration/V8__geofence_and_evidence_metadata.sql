-- V8__geofence_and_evidence_metadata.sql
-- Enforces configurable geofence per task and evidence watermark metadata

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS geofence_radius_meters INT NOT NULL DEFAULT 200;

ALTER TABLE task_evidence ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(8,2);
ALTER TABLE task_evidence ADD COLUMN IF NOT EXISTS raw_storage_path VARCHAR(1000);
ALTER TABLE task_evidence ADD COLUMN IF NOT EXISTS stamped_storage_path VARCHAR(1000);
ALTER TABLE task_evidence ADD COLUMN IF NOT EXISTS stamp_metadata JSONB DEFAULT '{}'::jsonb;

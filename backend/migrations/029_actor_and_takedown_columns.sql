-- 029_actor_and_takedown_columns.sql - record actors and product removals.
ALTER TABLE tracking_logs ADD COLUMN recorded_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN status_updated_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE products
    ADD COLUMN removed_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN removal_reason TEXT,
    ADD COLUMN removed_at TIMESTAMP;
ALTER TABLE supplier_profiles DROP COLUMN verification_status;

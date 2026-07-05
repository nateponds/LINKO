-- Milestone 4 & 6: Logistics Expansion and Notifications
-- Add tier_id to orders so buyers can choose delivery speed at checkout.
-- Add notifications table for real user alerts.

-- 1. Add tier_id to orders
ALTER TABLE orders
    ADD COLUMN tier_id INT REFERENCES service_tiers(tier_id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Backfill existing orders with a default tier (e.g. Standard, tier_id = 1, assuming it exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM service_tiers LIMIT 1) THEN
        UPDATE orders SET tier_id = (SELECT tier_id FROM service_tiers ORDER BY tier_id ASC LIMIT 1) WHERE tier_id IS NULL;
    END IF;
END $$;

-- Try to enforce NOT NULL if we successfully backfilled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM orders WHERE tier_id IS NULL) THEN
        ALTER TABLE orders ALTER COLUMN tier_id SET NOT NULL;
    END IF;
END $$;

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id, created_at DESC);

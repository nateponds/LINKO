-- 020: tracking return paths (course deliverable, professor mock-presentation TODO).
-- Branch checkpoints become explicit statuses (Arrived at Branch / Departed
-- Branch) and failed delivery gets its own event (Delivery Failed). 'In Transit'
-- is hard-removed: once checkpoints exist, "Departed X not yet Arrived Y" IS
-- in-transit, so the status carries no information. Existing rows are rewritten
-- before the CHECK is tightened. See local-notes/AGENT_HANDOFF.md (2026-07-16).

ALTER TABLE tracking_logs
  DROP CONSTRAINT tracking_logs_status_update_check;

UPDATE tracking_logs
   SET status_update = 'Departed Branch'
 WHERE status_update = 'In Transit';

ALTER TABLE tracking_logs
  ADD CONSTRAINT tracking_logs_status_update_check
  CHECK (status_update IN ('Order Created', 'Picked Up', 'Arrived at Branch',
                           'Departed Branch', 'Out for Delivery', 'Delivery Failed',
                           'Delivered', 'Returned', 'Cancelled'));

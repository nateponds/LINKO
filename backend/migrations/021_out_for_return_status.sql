-- 021: explicit final movement from the return branch to the sender.

ALTER TABLE tracking_logs
  DROP CONSTRAINT tracking_logs_status_update_check;

ALTER TABLE tracking_logs
  ADD CONSTRAINT tracking_logs_status_update_check
  CHECK (status_update IN ('Order Created', 'Picked Up', 'Arrived at Branch',
                           'Departed Branch', 'Out for Delivery', 'Delivery Failed',
                           'Out for Return', 'Delivered', 'Returned', 'Cancelled'));

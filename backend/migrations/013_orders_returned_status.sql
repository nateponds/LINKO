-- Failed delivery is a terminal marketplace order outcome. It is driven by a
-- Returned parcel tracking event, with platform_admin retained as an override.

ALTER TABLE orders
    DROP CONSTRAINT orders_status_check;

ALTER TABLE orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'accepted', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'));

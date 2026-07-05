-- Milestone 3: marketplace orders and invoices.
-- Orders belong to buyer and wholesaler businesses; logistics fulfillment is
-- intentionally deferred to Milestone 4 and remains separate from parcels.

CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    buyer_business_id INT NOT NULL REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    wholesaler_business_id INT NOT NULL REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'preparing', 'shipped', 'delivered', 'cancelled')),
    created_by INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_snapshot NUMERIC(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL UNIQUE REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_status
    ON orders (buyer_business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_wholesaler_status
    ON orders (wholesaler_business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_invoices_order
    ON invoices (order_id);

-- 026_inventory_batches.sql - batch-level expiry tracking for inventory.
--
-- Products keep the aggregate stock_quantity used by ordering and the existing
-- Inventory page. Expiry dates belong to physical batches, not products: the
-- same SKU may be received several times with different dates. A batch remains
-- actionable until depleted_at is set; this avoids introducing a second stock
-- total that could drift from products.stock_quantity.

CREATE TABLE inventory_batches (
    batch_id        SERIAL PRIMARY KEY,
    product_id      INT NOT NULL REFERENCES products(product_id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
    batch_number    VARCHAR(100) NOT NULL,
    manufactured_on DATE,
    received_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    expires_on      DATE NOT NULL,
    depleted_at     TIMESTAMP,
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT inventory_batches_number_not_blank
        CHECK (btrim(batch_number) <> ''),
    CONSTRAINT inventory_batches_manufactured_before_expiry
        CHECK (manufactured_on IS NULL OR manufactured_on <= expires_on),
    CONSTRAINT inventory_batches_product_number_unique
        UNIQUE (product_id, batch_number)
);

-- The expiry dashboard scans only batches that may still be on hand. Keeping
-- expires_on first makes expired/expiring-soon range checks index-friendly.
CREATE INDEX idx_inventory_batches_active_expiry
    ON inventory_batches (expires_on, product_id)
    WHERE depleted_at IS NULL;

-- Product detail and ownership-scoped reads start with product_id, then return
-- batches in FEFO order (first expiry, first out).
CREATE INDEX idx_inventory_batches_product_expiry
    ON inventory_batches (product_id, expires_on, batch_id);

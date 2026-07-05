-- Milestone 2: make marketplace products database-backed.
-- 001 created products/categories bare; this migration adds the marketplace
-- fields (price, image, stock, active flag), relaxes sku to optional, seeds the
-- 12 canonical categories, and adds non-negative CHECK guards.
--
-- The migration runner applies each file once inside a transaction, but the
-- statements below stay re-runnable-safe (IF NOT EXISTS / ON CONFLICT / guarded
-- ADD CONSTRAINT) so a manual replay against an existing DB is harmless.

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- The M2 API treats sku as optional (POST body: sku?). 001 declared it
-- NOT NULL UNIQUE; drop the NOT NULL so products can be created without one.
ALTER TABLE products ALTER COLUMN sku DROP NOT NULL;

-- Soft-delete (is_active) means a deleted product's sku should be reusable.
-- The table-wide UNIQUE from 001 (products_sku_key) blocks that, so drop it and
-- replace with a partial unique index scoped to ACTIVE, non-null skus. Duplicate
-- ACTIVE skus still raise 23505 (mapped to 400); reusing a soft-deleted sku is
-- allowed. IF EXISTS keeps this safe on a fresh DB where the constraint's name
-- may differ or it may already be absent.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_active_uq
    ON products (sku) WHERE is_active AND sku IS NOT NULL;

-- Non-negative money and stock. Guarded so a manual rerun does not error on
-- the already-present constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'products_unit_price_check'
           AND conrelid = 'products'::regclass
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_unit_price_check CHECK (unit_price >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'products_stock_quantity_check'
           AND conrelid = 'products'::regclass
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_business_active
    ON products (business_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_category
    ON products (category_id);

-- Seed the 12 canonical categories (the taxonomy that lived hardcoded in
-- src/components/navigation/SubNav.jsx). This table is now the single source.
INSERT INTO categories (category_name) VALUES
    ('Pork'), ('Beef'), ('Chicken'), ('Chips'), ('Fish'), ('Shellfish'),
    ('Produce'), ('Bakery'), ('Dairy'), ('Frozen'), ('Packaging'), ('Beverages')
ON CONFLICT (category_name) DO NOTHING;

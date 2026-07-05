-- First real database shape for the backend scaffold.
-- Table names use snake_case because that is the normal PostgreSQL style.
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'staff', 'wholesaler', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE businesses (
    business_id SERIAL PRIMARY KEY,
    business_name VARCHAR(100) NOT NULL,
    business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('buyer', 'wholesaler', 'both', 'individual', 'msme', 'corporation', 'other')),
    contact_number VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_businesses (
    user_id INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
    business_id INT REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, business_id)
);

-- Granular Philippine-hierarchy addresses. business_id is null for
-- ownerless branch addresses.
CREATE TABLE addresses (
    address_id SERIAL PRIMARY KEY,
    business_id INT REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE SET NULL,
    province VARCHAR(50) NOT NULL,
    city_municipality VARCHAR(50) NOT NULL,
    barangay VARCHAR(50),
    street_address VARCHAR(150),
    postal_code VARCHAR(10)
);

CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    warehouse_name VARCHAR(100) NOT NULL,
    address_id INT NOT NULL REFERENCES addresses(address_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_name VARCHAR(100) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    category_id INT REFERENCES categories(category_id) ON UPDATE CASCADE ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_items (
    item_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    warehouse_id INT NOT NULL REFERENCES warehouses(warehouse_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    reorder_threshold INT NOT NULL DEFAULT 10 CHECK (reorder_threshold >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, warehouse_id)
);

CREATE TABLE inventory_transactions (
    transaction_id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES inventory_items(item_id) ON UPDATE CASCADE ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment', 'transfer')),
    quantity_change INT NOT NULL,
    remarks TEXT,
    created_by INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_profiles (
    supplier_id INT PRIMARY KEY REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE CASCADE,
    minimum_order_quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    lead_time_days INT NOT NULL DEFAULT 7 CHECK (lead_time_days >= 0),
    delivery_terms TEXT,
    trust_rating DECIMAL(3,2) DEFAULT 5.00 CHECK (trust_rating >= 0.00 AND trust_rating <= 5.00),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

-- This trigger automatically writes an audit row whenever stock quantity is
-- changed directly in inventory_items. It gives the app a simple stock history.
CREATE OR REPLACE FUNCTION fn_log_inventory_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.quantity <> NEW.quantity THEN
        INSERT INTO inventory_transactions (item_id, transaction_type, quantity_change, remarks)
        VALUES (NEW.item_id, 'adjustment', NEW.quantity - OLD.quantity, 'Quantity auto-adjusted in stock update.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_inventory_mutation
AFTER UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION fn_log_inventory_mutation();

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_inventory_lookup ON inventory_items(warehouse_id, product_id);
CREATE INDEX idx_transactions_timeline ON inventory_transactions(item_id, created_at DESC);

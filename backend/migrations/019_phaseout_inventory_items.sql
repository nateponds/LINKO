-- Phase out the warehouse-level inventory subsystem. inventory_items +
-- inventory_transactions (001) modeled per-warehouse stock with an audit trail,
-- but the app never adopted them: the frontend Inventory tab drives
-- products.stock_quantity via /api/products, and no page ever called
-- /api/inventory. The route (GET real, POST/PATCH 501 stubs) is removed in the
-- same change. Neither table is a graded CIS 2104 core table (see
-- local-notes/course-deliverable.md, docs/LINKO_ERD.md).
--
-- Removed: the idx_inventory_lookup / idx_transactions_timeline indexes, the
-- AFTER UPDATE stock-audit trigger and its function, and the
-- inventory_items + inventory_transactions tables.
--
-- Kept: warehouses. It is shared infra (referenced by 002 logistics, 010, 017,
-- and the dev seed), not part of the unused inventory concept.
--
-- Drop order follows the dependency chain: indexes -> trigger -> function ->
-- inventory_transactions (FK to items) -> inventory_items.

DROP INDEX IF EXISTS idx_transactions_timeline;
DROP INDEX IF EXISTS idx_inventory_lookup;
DROP TRIGGER IF EXISTS trg_log_inventory_mutation ON inventory_items;
DROP FUNCTION IF EXISTS fn_log_inventory_mutation();
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_items;

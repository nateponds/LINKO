import { Router } from "express";
import { getPool, query, nextParcelId } from "../db.js";
import { MARKETPLACE_ROLES, requireAnyRole, requireAuth } from "../middleware/auth.js";
import {
  activeMemberships,
  isPlatformAdmin,
  resolveActiveBusinessId,
} from "../middleware/ownership.js";
import { notifyBusiness } from "../services/notify.js";
import { buildPaginatedResponse, parsePaginationQuery } from "../services/pagination.js";
import {
  computeRouteDistanceKm,
  createInitialRouteSnapshot,
  resolveInitialBranchId,
} from "../services/parcelRouting.js";

const router = Router();

const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

function asClientError(error) {
  if (["23503", "23514", "23505"].includes(error.code)) {
    error.statusCode = 400;
  }
  return error;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePositiveId(rawId, label) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(404, `${label} ${rawId} not found`);
  }
  return id;
}

// Resolve the business the caller is acting as (buyer/wholesaler): the ACTIVE
// business (X-Active-Business, or the caller's only business) when it holds one
// of `roles`. Roles on other businesses grant nothing. platform_admin holds no
// memberships (migration 027), so it never resolves one and is refused.
function resolveSingleMembership(req, roles, errorRoleLabel) {
  const active = activeMemberships(req).find((m) => roles.includes(m.role));
  if (active) {
    return active.business_id;
  }
  throw createHttpError(403, `You must belong to a ${errorRoleLabel} business`);
}

const ORDER_BASE_SELECT = `
  SELECT o.order_id,
         o.buyer_business_id,
         buyer.business_name AS buyer_business_name,
         o.wholesaler_business_id,
         wholesaler.business_name AS wholesaler_business_name,
         o.status,
         o.tier_id,
         (COALESCE(SUM(oi.quantity * oi.unit_price_snapshot), 0) + COALESCE(MAX(st.base_fee), 0))::text AS total,
         o.created_at,
         o.updated_at,
         i.invoice_id,
         i.invoice_number,
         i.total::text AS invoice_total,
         i.issued_at,
         (SELECT MAX(pc.parcel_id) FROM parcels pc WHERE pc.order_id = o.order_id) AS parcel_id,
         COUNT(oi.order_item_id)::int AS item_count
    FROM orders o
    JOIN businesses buyer ON buyer.business_id = o.buyer_business_id
    JOIN businesses wholesaler ON wholesaler.business_id = o.wholesaler_business_id
    LEFT JOIN service_tiers st ON st.tier_id = o.tier_id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN invoices i ON i.order_id = o.order_id`;

function orderFromRow(row, items) {
  const order = {
    order_id: row.order_id,
    buyer_business_id: row.buyer_business_id,
    buyer_business_name: row.buyer_business_name,
    wholesaler_business_id: row.wholesaler_business_id,
    wholesaler_business_name: row.wholesaler_business_name,
    status: row.status,
    tier_id: row.tier_id,
    parcel_id: row.parcel_id ?? null,
    total: row.total,
    created_at: row.created_at,
    updated_at: row.updated_at,
    invoice: row.invoice_id
      ? {
          invoice_id: row.invoice_id,
          invoice_number: row.invoice_number,
          total: row.invoice_total,
          issued_at: row.issued_at,
        }
      : null,
  };
  if (items === undefined) {
    order.item_count = Number(row.item_count);
  } else {
    order.items = items;
  }
  return order;
}

async function fetchOrders(whereSql, params, client = { query }) {
  const { rows } = await client.query(
    `${ORDER_BASE_SELECT}
      ${whereSql}
     GROUP BY o.order_id, buyer.business_name, wholesaler.business_name,
              i.invoice_id, i.invoice_number, i.total, i.issued_at
     ORDER BY o.created_at DESC, o.order_id DESC`,
    params,
  );

  if (!rows.length) return [];

  const orderIds = rows.map((row) => row.order_id);
  const itemResult = await client.query(
    `SELECT oi.order_item_id,
            oi.order_id,
            oi.product_id,
            p.product_name,
            p.sku,
            oi.quantity,
            oi.unit_price_snapshot::text AS unit_price_snapshot,
            (oi.quantity * oi.unit_price_snapshot)::text AS line_total
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
      WHERE oi.order_id = ANY($1::int[])
      ORDER BY oi.order_item_id`,
    [orderIds],
  );

  const itemsByOrder = new Map();
  for (const item of itemResult.rows) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push({
      order_item_id: item.order_item_id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price_snapshot: item.unit_price_snapshot,
      line_total: item.line_total,
    });
  }

  return rows.map((row) => orderFromRow(row, itemsByOrder.get(row.order_id) ?? []));
}

async function fetchOneOrder(orderId, client = { query }) {
  const orders = await fetchOrders("WHERE o.order_id = $1", [orderId], client);
  return orders[0] ?? null;
}

// Orders (and their invoices) the caller may read: every order the ACTIVE
// business is on, either side. Side comes from the order, not the caller's role
// (a wholesaler business also buys). The route gate already proved the active
// membership is buyer or wholesaler. Nobody else reads orders or invoices:
// their line items are confidential to the two parties.
function listScope(req) {
  return {
    where: "WHERE (o.buyer_business_id = $1 OR o.wholesaler_business_id = $1)",
    params: [resolveActiveBusinessId(req)],
  };
}

// Which side of `order` the active business is on: "buyer", "wholesaler", or
// null when it is not a party to the order. Always null for platform_admin:
// admins hold no memberships (migration 027), so they never resolve a side.
function orderSide(req, order) {
  const businessId = resolveActiveBusinessId(req);
  if (businessId === order.buyer_business_id) return "buyer";
  if (businessId === order.wholesaler_business_id) return "wholesaler";
  return null;
}

function readOrderStatus(query) {
  const status = query.status;
  if (status === undefined) return undefined;
  if (typeof status !== "string" || !ORDER_STATUSES.includes(status)) {
    throw createHttpError(400, "status must be a valid order status");
  }
  return status;
}

function appendFilter(scope, predicate, value) {
  const params = [...scope.params, value];
  const where = scope.where
    ? `${scope.where} AND ${predicate(params.length)}`
    : `WHERE ${predicate(params.length)}`;
  return { where, params };
}

function addOrderFilters(visibility, { status, q }) {
  let scope = visibility;
  if (status) {
    scope = appendFilter(scope, (index) => `o.status = $${index}`, status);
  }
  if (q) {
    scope = appendFilter(scope, (index) => `(
      CAST(o.order_id AS text) ILIKE $${index}
      OR buyer.business_name ILIKE $${index}
      OR wholesaler.business_name ILIKE $${index}
      OR i.invoice_number ILIKE $${index}
      OR EXISTS (
        SELECT 1 FROM parcels p
         WHERE p.order_id = o.order_id AND p.parcel_id ILIKE $${index}
      )
    )`, `%${q}%`);
  }
  return scope;
}

async function fetchOrderPage(whereSql, params, pagination) {
  const pageParams = [...params, pagination.limit, pagination.offset];
  const [pageResult, countResult] = await Promise.all([
    query(
      `${ORDER_BASE_SELECT}
        ${whereSql}
       GROUP BY o.order_id, buyer.business_name, wholesaler.business_name,
                i.invoice_id, i.invoice_number, i.total, i.issued_at
       ORDER BY o.created_at DESC, o.order_id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      pageParams,
    ),
    query(
      `SELECT COUNT(*)::int AS total_items
         FROM orders o
         JOIN businesses buyer ON buyer.business_id = o.buyer_business_id
         JOIN businesses wholesaler ON wholesaler.business_id = o.wholesaler_business_id
         LEFT JOIN invoices i ON i.order_id = o.order_id
        ${whereSql}`,
      params,
    ),
  ]);
  return buildPaginatedResponse(
    pageResult.rows.map((row) => orderFromRow(row)),
    pagination,
    countResult.rows[0].total_items,
  );
}

// `side` is orderSide(req, order), computed once by the caller.
function assertTransitionAllowed(req, order, side, nextStatus) {
  const allowed = {
    pending: ["accepted", "cancelled"],
    accepted: ["preparing"],
    preparing: ["shipped"],
    shipped: ["delivered", "returned", "cancelled"],
    delivered: [],
    cancelled: [],
    returned: [],
  };

  // Delivery outcomes are confirmed by parcel tracking (see
  // docs/API_CONTRACTS.md §3.6), never by the wholesaler.
  // platform_admin is never a seller: it may only force the delivery outcomes
  // (logistics override for stuck parcels) or cancel (governance).
  const canUpdate =
    (isPlatformAdmin(req.auth.user) && ["delivered", "returned", "cancelled"].includes(nextStatus)) ||
    (nextStatus === "cancelled" && order.status === "pending" && side === "buyer") ||
    (side === "wholesaler" &&
      nextStatus !== "delivered" &&
      nextStatus !== "returned" &&
      nextStatus !== "cancelled");

  if (!canUpdate) {
    throw createHttpError(403, "You cannot update this order status");
  }

  if (!allowed[order.status]?.includes(nextStatus)) {
    throw createHttpError(400, `Cannot move order from ${order.status} to ${nextStatus}`);
  }
}

async function createInvoiceForAcceptedOrder(client, orderId) {
  const totalResult = await client.query(
    `SELECT COALESCE(SUM(oi.quantity * oi.unit_price_snapshot), 0) + COALESCE(MAX(st.base_fee), 0) AS total
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN service_tiers st ON st.tier_id = o.tier_id
      WHERE o.order_id = $1`,
    [orderId],
  );
  const total = totalResult.rows[0].total;
  const invoiceNumber = `INV-${orderId}-${Date.now()}`;
  await client.query(
    `INSERT INTO invoices (order_id, invoice_number, total)
     VALUES ($1, $2, $3)`,
    [orderId, invoiceNumber, total],
  );
}

async function decrementStock(client, items) {
  const sorted = [...items].sort((a, b) => a.productId - b.productId);
  for (const item of sorted) {
    const stock = await client.query(
      `UPDATE products
          SET stock_quantity = stock_quantity - $1
        WHERE product_id = $2
          AND stock_quantity >= $1
      RETURNING product_id`,
      [item.quantity, item.productId],
    );
    if (!stock.rows.length) {
      throw createHttpError(400, "insufficient stock to place order");
    }
  }
}

export async function restoreOrderStock(client, orderId) {
  const itemResult = await client.query(
    `SELECT product_id, quantity
       FROM order_items
      WHERE order_id = $1
      ORDER BY product_id`,
    [orderId],
  );

  for (const item of itemResult.rows) {
    await client.query(
      `UPDATE products
          SET stock_quantity = stock_quantity + $1
        WHERE product_id = $2`,
      [item.quantity, item.product_id],
    );
  }
}

async function acceptOrder(client, orderId, actorId) {
  await client.query(
    `UPDATE orders
        SET status = 'accepted', status_updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = $1`,
    [orderId, actorId],
  );
  await createInvoiceForAcceptedOrder(client, orderId);
}

router.get(
  "/orders",
  requireAuth,
  requireAnyRole(MARKETPLACE_ROLES),
  async (req, res, next) => {
    try {
      const visibility = listScope(req);
      const pagination = parsePaginationQuery(req.query);
      const filters = { status: readOrderStatus(req.query), q: pagination.q };
      const scope = addOrderFilters(visibility, filters);
      res.json(await fetchOrderPage(scope.where, scope.params, pagination));
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.get(
  "/orders/:id",
  requireAuth,
  requireAnyRole(MARKETPLACE_ROLES),
  async (req, res, next) => {
    try {
      const orderId = parsePositiveId(req.params.id, "Order");
      const order = await fetchOneOrder(orderId);
      if (!order || !orderSide(req, order)) {
        throw createHttpError(404, `Order ${req.params.id} not found`);
      }
      res.json(order);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.post(
  "/orders",
  requireAuth,
  requireAnyRole(MARKETPLACE_ROLES),
  async (req, res, next) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { items, tier_id: reqTierId } = req.body ?? {};
      if (!Array.isArray(items) || items.length === 0) {
        throw createHttpError(400, "items must contain at least one product");
      }
      const tierId = Number(reqTierId);
      if (!Number.isInteger(tierId) || tierId <= 0) {
        throw createHttpError(400, "tier_id is required and must be a positive integer");
      }

      const normalizedItems = items.map((item) => {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);
        if (!Number.isInteger(productId) || productId <= 0) {
          throw createHttpError(400, "product_id must be a positive integer");
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw createHttpError(400, "quantity must be a positive integer");
        }
        return { productId, quantity };
      });

      const buyerBusinessId = resolveSingleMembership(req, MARKETPLACE_ROLES, "buyer or wholesaler");

      // Sprint 13 pin gate: the buyer business must have a pinned canonical
      // logistics address before placing orders, so ship time never blocks on
      // the buyer's missing pin (docs/LOCATION_ROUTING.md).
      const buyerPin = await client.query(
        `SELECT 1
           FROM businesses b
           JOIN addresses a ON a.address_id = b.logistics_address_id
          WHERE b.business_id = $1
            AND a.latitude IS NOT NULL
            AND a.longitude IS NOT NULL`,
        [buyerBusinessId],
      );
      if (!buyerPin.rows.length) {
        throw createHttpError(409, "Pin your business location in Settings before placing orders");
      }

      const tierResult = await client.query(
        "SELECT tier_id FROM service_tiers WHERE tier_id = $1",
        [tierId]
      );
      if (!tierResult.rows.length) {
        throw createHttpError(400, "invalid tier_id");
      }

      const productIds = normalizedItems.map((item) => item.productId);
      const productResult = await client.query(
        `SELECT product_id, business_id, unit_price
           FROM products
          WHERE product_id = ANY($1::int[])
            AND is_active = TRUE`,
        [productIds],
      );
      if (productResult.rows.length !== new Set(productIds).size) {
        throw createHttpError(400, "all order items must reference active products");
      }

      const products = new Map(productResult.rows.map((row) => [row.product_id, row]));
      const wholesalerIds = new Set(productResult.rows.map((row) => row.business_id));
      if (wholesalerIds.size !== 1) {
        throw createHttpError(400, "all order items must come from one wholesaler");
      }
      const wholesalerBusinessId = productResult.rows[0].business_id;
      if (wholesalerBusinessId === buyerBusinessId) {
        throw createHttpError(400, "buyer and wholesaler businesses must be different");
      }

      await client.query("BEGIN");
      const orderResult = await client.query(
        `INSERT INTO orders
           (buyer_business_id, wholesaler_business_id, tier_id, status, created_by, status_updated_by)
         VALUES ($1, $2, $3, 'pending', $4, $4)
         RETURNING order_id`,
        [buyerBusinessId, wholesalerBusinessId, tierId, req.auth.user.user_id],
      );
      const orderId = orderResult.rows[0].order_id;

      for (const item of normalizedItems) {
        const product = products.get(item.productId);
        await client.query(
          `INSERT INTO order_items
             (order_id, product_id, quantity, unit_price_snapshot)
           VALUES ($1, $2, $3, $4)`,
          [orderId, item.productId, item.quantity, product.unit_price],
        );
      }

      await decrementStock(client, normalizedItems);

      await notifyBusiness(
        client,
        wholesalerBusinessId,
        "New Order",
        `You have received a new order #${orderId}.`,
      );

      await client.query("COMMIT");
      const order = await fetchOneOrder(orderId);
      res.status(201).json(order);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(asClientError(error));
    } finally {
      client.release();
    }
  },
);

router.patch(
  "/orders/:id/status",
  requireAuth,
  requireAnyRole([...MARKETPLACE_ROLES, "platform_admin"]),
  async (req, res, next) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const orderId = parsePositiveId(req.params.id, "Order");
      // Sprint 13: total_distance_km is no longer read from the body - the
      // server computes the origin -> destination distance itself.
      const { status, weight_kg, dimensions } = req.body ?? {};
      const validStatuses = [
        "pending",
        "accepted",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ];
      if (!validStatuses.includes(status)) {
        throw createHttpError(400, "status is required and must be a valid order status");
      }
      // Shipping is the physical handoff: the wholesaler weighs the parcel
      // here, so the shipping fee is set from a real measurement.
      if (status === "shipped" && (Number(weight_kg) <= 0 || Number.isNaN(Number(weight_kg)))) {
        throw createHttpError(400, "weight_kg must be a number greater than 0");
      }
      await client.query("BEGIN");
      const lock = await client.query(
        `SELECT order_id, buyer_business_id, wholesaler_business_id, tier_id, status
           FROM orders
          WHERE order_id = $1
          FOR UPDATE`,
        [orderId],
      );
      if (!lock.rows.length) {
        throw createHttpError(404, `Order ${req.params.id} not found`);
      }
      const order = lock.rows[0];
      const side = orderSide(req, order);
      assertTransitionAllowed(req, order, side, status);

      if (status === "accepted") {
        await acceptOrder(client, orderId, req.auth.user.user_id);
      } else {
        await client.query(
          `UPDATE orders
              SET status = $1, status_updated_by = $3, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $2`,
          [status, orderId, req.auth.user.user_id],
        );

        if (status === "cancelled") {
          await restoreOrderStock(client, orderId);
        }

        if (status === "shipped") {
          const pricing = await client.query(
            `SELECT COALESCE(SUM(oi.quantity * oi.unit_price_snapshot), 0) AS declared_value
               FROM orders o
               LEFT JOIN order_items oi ON oi.order_id = o.order_id
              WHERE o.order_id = $1`,
            [orderId],
          );
          // Sprint 13: parcel endpoints come from each business's CANONICAL
          // logistics address (never a LIMIT 1 pick). A missing or unpinned
          // address hard-rolls-back the whole transition - shipping never
          // silently skips parcel creation (docs/LOCATION_ROUTING.md).
          const endpoints = await client.query(
            `SELECT b.business_id, a.address_id,
                    (a.latitude IS NOT NULL AND a.longitude IS NOT NULL) AS pinned
               FROM businesses b
               LEFT JOIN addresses a ON a.address_id = b.logistics_address_id
              WHERE b.business_id IN ($1, $2)`,
            [order.wholesaler_business_id, order.buyer_business_id],
          );
          const byBusiness = new Map(endpoints.rows.map((row) => [row.business_id, row]));
          const origin = byBusiness.get(order.wholesaler_business_id);
          const destination = byBusiness.get(order.buyer_business_id);
          if (!origin?.address_id || !origin.pinned) {
            throw createHttpError(409, "Pin your business location in Settings before shipping orders");
          }
          // Defensive: buyers are gated at order placement, but the pin may
          // have been removed between placing and shipping.
          if (!destination?.address_id || !destination.pinned) {
            throw createHttpError(409, "Buyer business has no pinned location");
          }

          const distanceKm = await computeRouteDistanceKm(
            client,
            origin.address_id,
            destination.address_id,
          );

          const parcelId = await nextParcelId(client);
          await client.query(
            `INSERT INTO parcels (parcel_id, order_id, sender_id, receiver_id, tier_id,
                                 origin_address_id, destination_address_id,
                                 weight_kg, dimensions, total_distance_km, declared_value,
                                 shipping_fee, estimated_delivery_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL,
                     CURRENT_DATE + (SELECT estimated_days FROM service_tiers WHERE tier_id = $5))`,
            [
              parcelId,
              orderId,
              order.wholesaler_business_id,
              order.buyer_business_id,
              order.tier_id,
              origin.address_id,
              destination.address_id,
              weight_kg,
              dimensions ?? null,
              distanceKm,
              pricing.rows[0].declared_value,
            ]
          );

          // Marketplace checkout is an online payment: settled at booking.
          // The dispatch gate stays modeled-not-enforced (course-deliverable).
          await client.query(
            `INSERT INTO payments (parcel_id, method, payment_status, amount, paid_at)
             VALUES ($1, 'Online', 'Paid', NULL, CURRENT_TIMESTAMP)`,
            [parcelId]
          );

          const branchId = await resolveInitialBranchId(client, origin.address_id);
          await client.query(
            `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, recorded_by)
             VALUES ($1, 'Order Created', 'System-generated from marketplace order', $2, $3)`,
            [parcelId, branchId, req.auth.user.user_id]
          );
          await createInitialRouteSnapshot(client, parcelId, branchId);
        }
      }

      if (status === "returned") {
        await notifyBusiness(
          client,
          order.buyer_business_id,
          "Delivery Failed - Order Returned",
          `Delivery failed - order #${orderId} returned to sender.`,
          "warning",
        );
        await notifyBusiness(
          client,
          order.wholesaler_business_id,
          "Parcel Returning to Sender",
          `Parcel for order #${orderId} is returning to you.`,
          "warning",
        );
      } else {
        const statusNotifications = {
          accepted: [order.buyer_business_id, "Order Accepted", "success"],
          shipped: [order.buyer_business_id, "Order Shipped", "info"],
          delivered: [order.buyer_business_id, "Order Delivered", "success"],
          cancelled: [
            side === "buyer" ? order.wholesaler_business_id : order.buyer_business_id,
            "Order Cancelled",
            "warning",
          ],
        };
        if (statusNotifications[status]) {
          const [businessId, title, type] = statusNotifications[status];
          await notifyBusiness(
            client,
            businessId,
            title,
            `Order #${orderId} is now ${status}.`,
            type,
          );
        }
      }

      await client.query("COMMIT");
      // The admin override never reveals the order's contents.
      if (isPlatformAdmin(req.auth.user)) {
        res.json({ order_id: orderId, status });
        return;
      }
      res.json(await fetchOneOrder(orderId));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(asClientError(error));
    } finally {
      client.release();
    }
  },
);

const INVOICE_BASE_SELECT = `
  SELECT i.invoice_id,
         i.invoice_number,
         i.order_id,
         o.status AS order_status,
         o.buyer_business_id,
         buyer.business_name AS buyer_business_name,
         o.wholesaler_business_id,
         wholesaler.business_name AS wholesaler_business_name,
         i.total::text AS total,
         i.issued_at,
         (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = i.order_id) AS item_count
    FROM invoices i
    JOIN orders o ON o.order_id = i.order_id
    JOIN businesses buyer ON buyer.business_id = o.buyer_business_id
    JOIN businesses wholesaler ON wholesaler.business_id = o.wholesaler_business_id`;

function invoiceFromRow(row, items) {
  const invoice = {
    invoice_id: row.invoice_id,
    invoice_number: row.invoice_number,
    order_id: row.order_id,
    order_status: row.order_status,
    buyer_business_id: row.buyer_business_id,
    buyer_business_name: row.buyer_business_name,
    wholesaler_business_id: row.wholesaler_business_id,
    wholesaler_business_name: row.wholesaler_business_name,
    total: row.total,
    issued_at: row.issued_at,
  };
  if (items === undefined) {
    invoice.item_count = Number(row.item_count);
  } else {
    invoice.items = items;
  }
  return invoice;
}

async function fetchInvoices(whereSql, params) {
  const { rows } = await query(
    `${INVOICE_BASE_SELECT}
      ${whereSql}
     ORDER BY i.issued_at DESC, i.invoice_id DESC`,
    params,
  );
  if (!rows.length) return [];

  const orderIds = rows.map((row) => row.order_id);
  const itemResult = await query(
    `SELECT oi.order_item_id,
            oi.order_id,
            oi.product_id,
            p.product_name,
            p.sku,
            oi.quantity,
            oi.unit_price_snapshot::text AS unit_price_snapshot,
            (oi.quantity * oi.unit_price_snapshot)::text AS line_total
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
      WHERE oi.order_id = ANY($1::int[])
      ORDER BY oi.order_item_id`,
    [orderIds],
  );

  const itemsByOrder = new Map();
  for (const item of itemResult.rows) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push({
      order_item_id: item.order_item_id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price_snapshot: item.unit_price_snapshot,
      line_total: item.line_total,
    });
  }

  return rows.map((row) => invoiceFromRow(row, itemsByOrder.get(row.order_id) ?? []));
}

function addInvoiceFilters(visibility, { status, q }) {
  let scope = visibility;
  if (status) {
    scope = appendFilter(scope, (index) => `o.status = $${index}`, status);
  }
  if (q) {
    scope = appendFilter(scope, (index) => `(
      i.invoice_number ILIKE $${index}
      OR CAST(i.order_id AS text) ILIKE $${index}
      OR buyer.business_name ILIKE $${index}
      OR wholesaler.business_name ILIKE $${index}
    )`, `%${q}%`);
  }
  return scope;
}

async function fetchInvoicePage(whereSql, params, pagination) {
  const pageParams = [...params, pagination.limit, pagination.offset];
  const [pageResult, countResult] = await Promise.all([
    query(
      `${INVOICE_BASE_SELECT}
        ${whereSql}
       ORDER BY i.issued_at DESC, i.invoice_id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      pageParams,
    ),
    query(
      `SELECT COUNT(*)::int AS total_items
         FROM invoices i
         JOIN orders o ON o.order_id = i.order_id
         JOIN businesses buyer ON buyer.business_id = o.buyer_business_id
         JOIN businesses wholesaler ON wholesaler.business_id = o.wholesaler_business_id
        ${whereSql}`,
      params,
    ),
  ]);
  return buildPaginatedResponse(
    pageResult.rows.map((row) => invoiceFromRow(row)),
    pagination,
    countResult.rows[0].total_items,
  );
}

router.get(
  "/invoices",
  requireAuth,
  requireAnyRole(MARKETPLACE_ROLES),
  async (req, res, next) => {
    try {
      const visibility = listScope(req);
      const pagination = parsePaginationQuery(req.query);
      const filters = { status: readOrderStatus(req.query), q: pagination.q };
      const scope = addInvoiceFilters(visibility, filters);
      res.json(await fetchInvoicePage(scope.where, scope.params, pagination));
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.get(
  "/invoices/:id",
  requireAuth,
  requireAnyRole(MARKETPLACE_ROLES),
  async (req, res, next) => {
    try {
      const invoiceId = parsePositiveId(req.params.id, "Invoice");
      const scope = appendFilter(listScope(req), (index) => `i.invoice_id = $${index}`, invoiceId);
      const invoices = await fetchInvoices(scope.where, scope.params);
      if (!invoices.length) {
        throw createHttpError(404, `Invoice ${req.params.id} not found`);
      }
      res.json(invoices[0]);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

export default router;

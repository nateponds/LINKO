import { Router } from "express";
import { getPool, query, nextParcelId } from "../db.js";
import { requireAnyRole, requireAuth } from "../middleware/auth.js";
import { getActiveMembership } from "../middleware/ownership.js";
import { notifyBusiness } from "../services/notify.js";

const router = Router();

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

const isAdmin = (auth) => auth.user.global_role === "platform_admin";

async function findBranchIdByCity(client, cityMunicipality) {
  if (!cityMunicipality) return null;
  const { rows } = await client.query(
    `SELECT b.branch_id
       FROM branches b
       JOIN addresses a ON a.address_id = b.address_id
      WHERE LOWER(a.city_municipality) = LOWER($1)
      LIMIT 1`,
    [cityMunicipality],
  );
  return rows[0]?.branch_id ?? null;
}

function membershipIds(auth, role) {
  return auth.memberships
    .filter((membership) => membership.role === role)
    .map((membership) => membership.business_id);
}

// Resolve the business the caller is acting as (buyer/wholesaler). Multi-business
// users disambiguate via the X-Active-Business header (validated in
// getActiveMembership); single-membership behavior is unchanged. A platform_admin
// with no such membership falls back to an explicit body business_id.
function resolveSingleMembership(req, roles, adminBodyBusinessId, errorRoleLabel) {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  const hasMatching = req.auth.memberships.some((m) => roleArray.includes(m.role));
  if (hasMatching) {
    return getActiveMembership(req, roleArray).business_id;
  }
  if (isAdmin(req.auth) && adminBodyBusinessId !== undefined && adminBodyBusinessId !== null) {
    return Number(adminBodyBusinessId);
  }
  throw createHttpError(403, `You must belong to a ${errorRoleLabel} business`);
}

async function validateBusinessRole(businessId, businessTypes) {
  const { rows } = await query(
    `SELECT business_id FROM businesses
      WHERE business_id = $1 AND business_type = ANY($2::varchar[])`,
    [businessId, businessTypes],
  );
  if (!rows.length) {
    throw createHttpError(400, "business_id does not reference a valid business for this action");
  }
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
         (SELECT MAX(pc.parcel_id) FROM parcels pc WHERE pc.order_id = o.order_id) AS parcel_id
    FROM orders o
    JOIN businesses buyer ON buyer.business_id = o.buyer_business_id
    JOIN businesses wholesaler ON wholesaler.business_id = o.wholesaler_business_id
    LEFT JOIN service_tiers st ON st.tier_id = o.tier_id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN invoices i ON i.order_id = o.order_id`;

function orderFromRow(row, items = []) {
  return {
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
    items,
    invoice: row.invoice_id
      ? {
          invoice_id: row.invoice_id,
          invoice_number: row.invoice_number,
          total: row.invoice_total,
          issued_at: row.issued_at,
        }
      : null,
  };
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

function orderVisibility(auth) {
  if (isAdmin(auth)) {
    return { where: "", params: [] };
  }

  const buyerIds = membershipIds(auth, "buyer");
  const wholesalerIds = membershipIds(auth, "wholesaler");
  const clauses = [];
  const params = [];

  if (buyerIds.length) {
    params.push(buyerIds);
    clauses.push(`o.buyer_business_id = ANY($${params.length}::int[])`);
  }
  if (wholesalerIds.length) {
    params.push(wholesalerIds);
    clauses.push(`o.wholesaler_business_id = ANY($${params.length}::int[])`);
  }

  // No buyer/wholesaler membership (e.g. courier, coordinator): empty clause
  // list would render "WHERE " and break the SQL.
  if (!clauses.length) {
    return { where: "WHERE FALSE", params: [] };
  }

  return { where: `WHERE ${clauses.join(" OR ")}`, params };
}

function isVisibleOrder(auth, order) {
  if (isAdmin(auth)) return true;
  return auth.memberships.some(
    (membership) =>
      (membership.role === "buyer" && membership.business_id === order.buyer_business_id) ||
      (membership.role === "wholesaler" && membership.business_id === order.wholesaler_business_id),
  );
}

function canBuyerCancel(auth, order) {
  if (isAdmin(auth)) return false;
  return auth.memberships.some(
    (membership) =>
      membership.role === "buyer" && membership.business_id === order.buyer_business_id,
  );
}

function canWholesalerManage(auth, order) {
  if (isAdmin(auth)) return false;
  return auth.memberships.some(
    (membership) =>
      membership.role === "wholesaler" && membership.business_id === order.wholesaler_business_id,
  );
}

function assertTransitionAllowed(auth, order, nextStatus) {
  const allowed = {
    pending: ["accepted", "cancelled"],
    accepted: ["preparing"],
    preparing: ["shipped"],
    shipped: ["delivered", "returned"],
    delivered: [],
    cancelled: [],
    returned: [],
  };

  // Delivery outcomes are confirmed by parcel tracking (see
  // docs/API_CONTRACTS.md §3.6), never by the wholesaler.
  // platform_admin keeps a manual override for stuck or legacy orders.
  const canUpdate =
    isAdmin(auth) ||
    (nextStatus === "cancelled" && canBuyerCancel(auth, order)) ||
    (canWholesalerManage(auth, order) &&
      nextStatus !== "delivered" &&
      nextStatus !== "returned");

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

async function acceptOrder(client, orderId) {
  const itemResult = await client.query(
    `SELECT product_id, quantity
       FROM order_items
      WHERE order_id = $1
      ORDER BY order_item_id`,
    [orderId],
  );

  for (const item of itemResult.rows) {
    const stock = await client.query(
      `UPDATE products
          SET stock_quantity = stock_quantity - $1
        WHERE product_id = $2
          AND stock_quantity >= $1
      RETURNING product_id`,
      [item.quantity, item.product_id],
    );
    if (!stock.rows.length) {
      throw createHttpError(400, "insufficient stock to accept order");
    }
  }

  await client.query(
    `UPDATE orders
        SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE order_id = $1`,
    [orderId],
  );
  await createInvoiceForAcceptedOrder(client, orderId);
}

router.get(
  "/orders",
  requireAuth,
  requireAnyRole(["buyer", "wholesaler", "platform_admin"]),
  async (req, res, next) => {
    try {
      const visibility = orderVisibility(req.auth);
      const orders = await fetchOrders(visibility.where, visibility.params);
      res.json(orders);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.get(
  "/orders/:id",
  requireAuth,
  requireAnyRole(["buyer", "wholesaler", "platform_admin"]),
  async (req, res, next) => {
    try {
      const orderId = parsePositiveId(req.params.id, "Order");
      const order = await fetchOneOrder(orderId);
      if (!order || !isVisibleOrder(req.auth, order)) {
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
  requireAnyRole(["buyer", "wholesaler", "platform_admin"]),
  async (req, res, next) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { items, buyer_business_id: bodyBuyerBusinessId, tier_id: reqTierId } = req.body ?? {};
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

      const buyerBusinessId = resolveSingleMembership(
        req,
        ["buyer", "wholesaler"],
        bodyBuyerBusinessId,
        "buyer or wholesaler",
      );
      if (isAdmin(req.auth)) {
        await validateBusinessRole(buyerBusinessId, ["buyer", "wholesaler"]);
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
           (buyer_business_id, wholesaler_business_id, tier_id, status, created_by)
         VALUES ($1, $2, $3, 'pending', $4)
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
  requireAnyRole(["buyer", "wholesaler", "platform_admin"]),
  async (req, res, next) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const orderId = parsePositiveId(req.params.id, "Order");
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
      assertTransitionAllowed(req.auth, order, status);

      if (status === "accepted") {
        await acceptOrder(client, orderId);
      } else {
        await client.query(
          `UPDATE orders
              SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $2`,
          [status, orderId],
        );

        if (status === "shipped") {
          const pricing = await client.query(
            `SELECT COALESCE(SUM(oi.quantity * oi.unit_price_snapshot), 0) AS declared_value,
                    COALESCE(MAX(st.base_fee), 0) AS shipping_fee
               FROM orders o
               LEFT JOIN order_items oi ON oi.order_id = o.order_id
               LEFT JOIN service_tiers st ON st.tier_id = o.tier_id
              WHERE o.order_id = $1`,
            [orderId],
          );
          const originAddress = await client.query(
            "SELECT address_id, city_municipality FROM addresses WHERE business_id = $1 LIMIT 1",
            [order.wholesaler_business_id]
          );
          const destAddress = await client.query(
            "SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1",
            [order.buyer_business_id]
          );

          if (originAddress.rows.length > 0 && destAddress.rows.length > 0) {
            const parcelId = await nextParcelId(client);
            await client.query(
              `INSERT INTO parcels (parcel_id, order_id, sender_id, receiver_id, tier_id,
                                   origin_address_id, destination_address_id,
                                   weight_kg, dimensions, total_distance_km, declared_value,
                                   shipping_fee, estimated_delivery_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11,
                       CURRENT_DATE + (SELECT estimated_days FROM service_tiers WHERE tier_id = $5))`,
              [
                parcelId,
                orderId,
                order.wholesaler_business_id,
                order.buyer_business_id,
                order.tier_id,
                originAddress.rows[0].address_id,
                destAddress.rows[0].address_id,
                weight_kg,
                dimensions ?? null,
                pricing.rows[0].declared_value,
                pricing.rows[0].shipping_fee,
              ]
            );

            // Marketplace checkout is an online payment: settled at booking.
            // The dispatch gate stays modeled-not-enforced (course-deliverable).
            await client.query(
              `INSERT INTO payments (parcel_id, method, payment_status, amount, paid_at)
               VALUES ($1, 'Online', 'Paid', NULL, CURRENT_TIMESTAMP)`,
              [parcelId]
            );

            await client.query(
              `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id)
               VALUES ($1, 'Order Created', 'System-generated from marketplace order', $2)`,
              [
                parcelId,
                await findBranchIdByCity(client, originAddress.rows[0].city_municipality),
              ]
            );
          }
        }
      }

      if (status === "returned") {
        await notifyBusiness(
          client,
          order.buyer_business_id,
          "Delivery Failed — Order Returned",
          `Delivery failed — order #${orderId} returned to sender.`,
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
            canBuyerCancel(req.auth, order)
              ? order.wholesaler_business_id
              : order.buyer_business_id,
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
      const updated = await fetchOneOrder(orderId);
      res.json(updated);
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
         i.issued_at
    FROM invoices i
    JOIN orders o ON o.order_id = i.order_id
    JOIN businesses buyer ON buyer.business_id = o.buyer_business_id
    JOIN businesses wholesaler ON wholesaler.business_id = o.wholesaler_business_id`;

function invoiceFromRow(row, items = []) {
  return {
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
    items,
  };
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

function invoiceVisibility(auth) {
  if (isAdmin(auth)) {
    return { where: "", params: [] };
  }

  const buyerIds = membershipIds(auth, "buyer");
  const wholesalerIds = membershipIds(auth, "wholesaler");
  const clauses = [];
  const params = [];

  if (buyerIds.length) {
    params.push(buyerIds);
    clauses.push(`o.buyer_business_id = ANY($${params.length}::int[])`);
  }
  if (wholesalerIds.length) {
    params.push(wholesalerIds);
    clauses.push(`o.wholesaler_business_id = ANY($${params.length}::int[])`);
  }

  // Same guard as orderVisibility: membership-less callers get no rows, not
  // broken SQL.
  if (!clauses.length) {
    return { where: "WHERE FALSE", params: [] };
  }

  return { where: `WHERE ${clauses.join(" OR ")}`, params };
}

router.get(
  "/invoices",
  requireAuth,
  requireAnyRole(["buyer", "wholesaler", "platform_admin"]),
  async (req, res, next) => {
    try {
      const visibility = invoiceVisibility(req.auth);
      const invoices = await fetchInvoices(visibility.where, visibility.params);
      res.json(invoices);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.get(
  "/invoices/:id",
  requireAuth,
  requireAnyRole(["buyer", "wholesaler", "platform_admin"]),
  async (req, res, next) => {
    try {
      const invoiceId = parsePositiveId(req.params.id, "Invoice");
      const visibility = invoiceVisibility(req.auth);
      const prefix = visibility.where ? `${visibility.where} AND` : "WHERE";
      const invoices = await fetchInvoices(
        `${prefix} i.invoice_id = $${visibility.params.length + 1}`,
        [...visibility.params, invoiceId],
      );
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

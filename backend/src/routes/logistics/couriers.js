import { Router } from "express";
import { query } from "../../db.js";
import { requireAnyRole, requireAuth } from "../../middleware/auth.js";
import { courierActiveLoadJoin } from "../../services/parcelRouting.js";
import {
  buildPaginatedResponse,
  parsePaginationQuery,
} from "../../services/pagination.js";
import {
  asClientError,
  createHttpError,
  hasOwn,
  LOGISTICS_OPS_ROLES,
  LOGISTICS_REFERENCE_READ_ROLES,
  TERMINAL_TRACKING_STATUS_LIST,
} from "./shared.js";

const router = Router();

router.get(
  "/couriers",
  requireAuth,
  requireAnyRole(LOGISTICS_REFERENCE_READ_ROLES),
  async (req, res) => {
    const filters = parsePaginationQuery(req.query);
    const params = [];
    let search = "";
    if (filters.q) {
      params.push(filters.q);
      const qParam = params.length;
      search = ` AND (c.full_name ILIKE '%' || $${qParam} || '%'
        OR c.phone_number ILIKE '%' || $${qParam} || '%'
        OR c.vehicle_type ILIKE '%' || $${qParam} || '%'
        OR b.branch_name ILIKE '%' || $${qParam} || '%')`;
    }
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total_items
         FROM couriers c
         LEFT JOIN branches b ON b.branch_id = c.assigned_branch_id
        WHERE c.is_active${search}`,
      params,
    );
    params.push(TERMINAL_TRACKING_STATUS_LIST);
    const loadJoin = courierActiveLoadJoin(params.length);
    params.push(filters.limit, filters.offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;
    const { rows } = await query(
      `
      SELECT c.courier_id, c.full_name, c.phone_number, c.vehicle_type,
             c.assigned_branch_id, b.branch_name AS assigned_branch_name,
             COALESCE(courier_load.active_parcel_count, 0)::int AS active_parcel_count
        FROM couriers c
        LEFT JOIN branches b ON b.branch_id = c.assigned_branch_id
        ${loadJoin}
       WHERE c.is_active${search}
       ORDER BY c.full_name ASC, c.courier_id ASC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    res.json(buildPaginatedResponse(rows, filters, countRows[0].total_items));
  },
);

router.get(
  "/couriers/options",
  requireAuth,
  requireAnyRole(LOGISTICS_REFERENCE_READ_ROLES),
  async (_req, res) => {
    const { rows } = await query(
      `SELECT c.courier_id, c.full_name,
              COALESCE(courier_load.active_parcel_count, 0)::int AS active_parcel_count
         FROM couriers c
         ${courierActiveLoadJoin(1)}
        WHERE c.is_active
        ORDER BY c.full_name ASC, c.courier_id ASC`,
      [TERMINAL_TRACKING_STATUS_LIST],
    );
    res.json(rows);
  },
);

// Couriers are minted only via POST /api/admin/users (kind=courier), which
// creates the linked login. Here coordinators/admins edit an existing courier's
// logistics fields. full_name is not editable -- it mirrors the user account.
// Partial: omitted keys are left unchanged; an explicit assigned_branch_id:null
// unassigns (COALESCE cannot write null, so the branch column uses a presence
// flag + CASE WHEN).
router.patch(
  "/couriers/:id",
  requireAuth,
  requireAnyRole(LOGISTICS_OPS_ROLES),
  async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const { phone_number, vehicle_type, assigned_branch_id } = body;
      const branchProvided = hasOwn(body, "assigned_branch_id");

      if (branchProvided && assigned_branch_id != null) {
        const active = await query(
          "SELECT 1 FROM branches WHERE branch_id = $1 AND is_active",
          [assigned_branch_id],
        );
        if (!active.rowCount) {
          return next(
            createHttpError(
              400,
              "assigned_branch_id must reference an active branch",
            ),
          );
        }
      }

      const { rows } = await query(
        `UPDATE couriers SET
           phone_number = COALESCE($2, phone_number),
           vehicle_type = COALESCE($3, vehicle_type),
           assigned_branch_id = CASE WHEN $4 THEN $5 ELSE assigned_branch_id END
         WHERE courier_id = $1 AND is_active
         RETURNING courier_id, full_name, phone_number, vehicle_type, assigned_branch_id`,
        [
          req.params.id,
          phone_number ?? null,
          vehicle_type ?? null,
          branchProvided,
          assigned_branch_id ?? null,
        ],
      );
      if (!rows.length) {
        return next(createHttpError(404, `Courier ${req.params.id} not found`));
      }
      res.json(rows[0]);
    } catch (e) {
      next(asClientError(e));
    }
  },
);

router.delete(
  "/couriers/:id",
  requireAuth,
  requireAnyRole(LOGISTICS_OPS_ROLES),
  async (req, res, next) => {
    try {
      const { rowCount } = await query(
        "UPDATE couriers SET is_active = false WHERE courier_id = $1 AND is_active",
        [req.params.id],
      );
      if (!rowCount) {
        return next(createHttpError(404, `Courier ${req.params.id} not found`));
      }
      res.status(204).end();
    } catch (e) {
      next(asClientError(e));
    }
  },
);

export default router;

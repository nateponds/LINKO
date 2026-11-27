export const LATEST_PARCEL_LOG_SQL = `
  LEFT JOIN LATERAL (
    SELECT status_update, scanned_at, courier_id, branch_id
      FROM tracking_logs tl
     WHERE tl.parcel_id = p.parcel_id
     ORDER BY tl.scanned_at DESC, tl.log_id DESC
     LIMIT 1
  ) latest ON TRUE`;

// Inserts one notification per member of a business. Pass the route's
// transaction client so the insert commits/rolls back with the action.
export async function notifyBusiness(client, businessId, title, message, type = "info") {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, type)
     SELECT DISTINCT user_id, $1, $2, $3
       FROM business_memberships
      WHERE business_id = $4`,
    [title, message, type, businessId],
  );
}

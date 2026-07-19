export function buildAdminListPath(path, { page, limit, q }) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const query = q.trim();
  if (query) params.set("q", query);
  return `${path}?${params}`;
}

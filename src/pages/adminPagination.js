import { buildListPath } from "../lib/pagination.js";

export function buildAdminListPath(path, { page, limit, q }) {
  return buildListPath(path, { page, limit, q });
}

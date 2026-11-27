import { buildListPath } from "../../lib/pagination.js";

export function buildLogisticsListPath(path, { page, limit, q }) {
  return buildListPath(path, { page, limit, q });
}

import { buildListPath } from "../../lib/pagination.js";

export function apiPath(path, values = {}) {
  return buildListPath(path, values);
}

export function normalizePage(data) {
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? { page: 1, limit: 10, total_items: 0, total_pages: 0 },
  };
}

export function shouldClampPage(pagination) {
  return Number(pagination?.total_items) > 0
    && Number(pagination?.total_pages) > 0
    && Number(pagination?.page) > Number(pagination?.total_pages);
}

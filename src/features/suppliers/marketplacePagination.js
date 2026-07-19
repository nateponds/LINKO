export function apiPath(path, values = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
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

export function saveCartLine(cart, product, quantity) {
  return {
    ...cart,
    [product.product_id]: {
      product: { ...product },
      quantity,
    },
  };
}

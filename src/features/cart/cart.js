const CART_KEY_PREFIX = "linko-cart:";

export function cartStorageKey(userId) {
  return `${CART_KEY_PREFIX}${userId}`;
}

export function shouldClearStoredCart(previousUserId, nextUserId) {
  return previousUserId != null && previousUserId !== "" && (nextUserId == null || nextUserId === "");
}

export function stockLimit(product) {
  const stock = Number(product?.stock_quantity);
  if (!Number.isFinite(stock) || stock < 0) return 0;
  return Math.floor(stock);
}

export function isUnavailable(product) {
  return stockLimit(product) <= 0 || product?.stock_status === "out_of_stock";
}

export function clampQuantity(value, max) {
  const ceiling = Math.max(Math.floor(Number(max)) || 0, 1);
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(Math.floor(quantity), 1), ceiling);
}

export function addCartLine(cart, product, quantity = 1) {
  if (!product?.product_id || isUnavailable(product)) {
    return { cart, error: "That product is out of stock." };
  }

  const max = stockLimit(product);
  const key = String(product.product_id);
  const added = clampQuantity(quantity, max);
  const nextQuantity = Math.min((Number(cart?.[key]?.quantity) || 0) + added, max);

  return {
    cart: {
      ...cart,
      [key]: {
        product: { ...product },
        quantity: nextQuantity,
      },
    },
    error: null,
  };
}

export function setCartLineQuantity(cart, productId, quantity) {
  const key = String(productId);
  const line = cart?.[key];
  if (!line) return cart ?? {};

  const max = stockLimit(line.product);
  if (isUnavailable(line.product)) {
    return removeCartLine(cart, key);
  }

  return {
    ...cart,
    [key]: {
      ...line,
      quantity: clampQuantity(quantity, max),
    },
  };
}

export function removeCartLine(cart, productId) {
  const next = { ...(cart ?? {}) };
  delete next[String(productId)];
  return next;
}

export function removeCartLines(cart, productIds) {
  const drop = new Set((productIds ?? []).map((id) => String(id)));
  const next = {};
  for (const [key, line] of Object.entries(cart ?? {})) {
    if (!drop.has(key)) next[key] = line;
  }
  return next;
}

export function cartLineItems(cart) {
  return Object.entries(cart ?? {}).map(([productId, line]) => ({
    productId,
    product: line.product,
    quantity: line.quantity,
    lineTotal: Number(line.product?.unit_price ?? 0) * line.quantity,
  }));
}

export function cartCount(cart) {
  return cartLineItems(cart).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
}

export function supplierGroups(cart) {
  const groups = new Map();
  for (const line of cartLineItems(cart)) {
    const businessId = String(line.product?.business_id ?? "unknown");
    if (!groups.has(businessId)) {
      groups.set(businessId, {
        businessId,
        businessName: line.product?.business_name || "Supplier",
        lines: [],
      });
    }
    groups.get(businessId).lines.push(line);
  }
  return [...groups.values()];
}

export function linesSubtotal(lines) {
  return lines.reduce((sum, line) => sum + Number(line.product?.unit_price ?? 0) * line.quantity, 0);
}

export function bundleSubtotal(cart) {
  return linesSubtotal(cartLineItems(cart));
}

export function tierBaseFee(tier) {
  const fee = Number(tier?.base_fee ?? 0);
  return Number.isFinite(fee) ? fee : 0;
}

export function bundleDeliveryFee(tier, groupCount) {
  if (!groupCount) return 0;
  return tierBaseFee(tier) * groupCount;
}

export function checkoutBlocker(cart) {
  for (const line of cartLineItems(cart)) {
    const name = line.product?.product_name ?? "A product";
    if (isUnavailable(line.product)) {
      return `${name} is out of stock.`;
    }
    const max = stockLimit(line.product);
    if (line.quantity > max) {
      return `${name} only has ${max} available.`;
    }
  }
  return null;
}

export function orderItemsForGroup(group) {
  return group.lines.map((line) => ({
    product_id: line.product.product_id,
    quantity: line.quantity,
  }));
}

export function isLocationPinError(error) {
  if (Number(error?.status) === 409) return true;
  return /pin your business location/i.test(error?.message ?? "");
}

function normalizeStoredCart(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const cart = {};
  for (const line of Object.values(value)) {
    const product = line?.product;
    const productId = product?.product_id;
    const quantity = Math.floor(Number(line?.quantity));
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue;
    if (isUnavailable(product)) continue;
    const max = stockLimit(product);
    cart[String(productId)] = {
      product: { ...product },
      quantity: Math.min(quantity, max),
    };
  }
  return cart;
}

export function readStoredCart(storage, userId) {
  if (!storage || userId == null || userId === "") return {};
  try {
    const raw = storage.getItem(cartStorageKey(userId));
    if (!raw) return {};
    return normalizeStoredCart(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeStoredCart(storage, userId, cart) {
  if (!storage || userId == null || userId === "") return;
  storage.setItem(cartStorageKey(userId), JSON.stringify(cart ?? {}));
}

export function clearStoredCart(storage, userId) {
  if (!storage || userId == null || userId === "") return;
  storage.removeItem(cartStorageKey(userId));
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  addCartLine,
  cartStorageKey,
  clearStoredCart,
  isLocationPinError,
  readStoredCart,
  removeCartLines,
  setCartLineQuantity,
  shouldClearStoredCart,
  supplierGroups,
  writeStoredCart,
} from "./cart.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const rice = {
  product_id: 9,
  product_name: "Rice",
  unit_price: "48.50",
  stock_quantity: 20,
  stock_status: "in_stock",
  business_id: 3,
  business_name: "North Farm",
};

test("addCartLine retains a display snapshot beyond the current product page", () => {
  const { cart, error } = addCartLine({}, rice, 3);

  assert.equal(error, null);
  assert.deepEqual(cart, {
    9: {
      product: rice,
      quantity: 3,
    },
  });
});

test("addCartLine clamps to stock and rejects out-of-stock products", () => {
  const first = addCartLine({}, rice, 50);
  assert.equal(first.cart[9].quantity, 20);

  const more = addCartLine(first.cart, rice, 1);
  assert.equal(more.cart[9].quantity, 20);

  const empty = addCartLine({}, { ...rice, product_id: 4, stock_quantity: 0, stock_status: "out_of_stock" }, 1);
  assert.equal(empty.error, "That product is out of stock.");
  assert.deepEqual(empty.cart, {});
});

test("setCartLineQuantity cannot exceed available stock", () => {
  const { cart } = addCartLine({}, { ...rice, stock_quantity: 4 }, 1);
  const next = setCartLineQuantity(cart, 9, 9);
  assert.equal(next[9].quantity, 4);
});

test("cart storage is scoped to the logged-in user and cleared on logout", () => {
  const storage = memoryStorage();
  const { cart } = addCartLine({}, rice, 2);

  assert.equal(cartStorageKey(15), "linko-cart:15");
  writeStoredCart(storage, 15, cart);
  writeStoredCart(storage, 16, {});

  assert.equal(readStoredCart(storage, 15)[9].quantity, 2);
  assert.deepEqual(readStoredCart(storage, 16), {});

  assert.equal(shouldClearStoredCart(15, null), true);
  assert.equal(shouldClearStoredCart(15, 16), false);
  clearStoredCart(storage, 15);
  assert.deepEqual(readStoredCart(storage, 15), {});
});

test("successful merchant lines leave the cart and failed merchant lines stay", () => {
  let cart = addCartLine({}, rice, 2).cart;
  cart = addCartLine(cart, {
    ...rice,
    product_id: 11,
    product_name: "Oil",
    business_id: 8,
    business_name: "South Mill",
  }, 1).cart;

  const groups = supplierGroups(cart);
  assert.deepEqual(groups.map((group) => group.businessId), ["3", "8"]);

  const remaining = removeCartLines(cart, groups[0].lines.map((line) => line.product.product_id));
  assert.deepEqual(Object.keys(remaining), ["11"]);
  assert.equal(remaining[11].product.business_name, "South Mill");
});

test("isLocationPinError recognizes the settings pin rejection", () => {
  assert.equal(isLocationPinError({ status: 409, message: "Pin your business location in Settings before placing orders" }), true);
  assert.equal(isLocationPinError({ message: "Pin your business location in Settings before placing orders" }), true);
  assert.equal(isLocationPinError({ status: 400, message: "invalid tier_id" }), false);
});

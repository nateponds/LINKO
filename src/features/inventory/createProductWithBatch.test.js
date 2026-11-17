import test from "node:test";
import assert from "node:assert/strict";
import { createProductWithBatch } from "./createProductWithBatch.js";

test("creates a product without a batch when expiry is omitted", async () => {
  const calls = [];
  await createProductWithBatch(async (path, options) => {
    calls.push([path, options]);
    return { product_id: 42 };
  }, { product_name: "Rice" }, null, null, () => {});
  assert.deepEqual(calls.map(([path]) => path), ["/api/products"]);
});

test("retries a failed batch without creating the product again", async () => {
  const calls = [];
  let id = null;
  const batch = { batch_number: "LOT-1", expires_on: "2027-01-01", received_on: "", manufactured_on: "", notes: "" };
  const send = async (path, options) => {
    calls.push([path, options]);
    if (path === "/api/products") return { product_id: 42 };
    if (calls.length === 2) throw new Error("Batch failed");
  };
  await assert.rejects(createProductWithBatch(send, {}, batch, id, (value) => { id = value; }), /Batch failed/);
  await createProductWithBatch(send, {}, batch, id, () => assert.fail("product created again"));
  assert.deepEqual(calls.map(([path]) => path), ["/api/products", "/api/inventory-batches", "/api/inventory-batches"]);
  assert.equal(calls[2][1].body.product_id, 42);
  assert.equal(calls[2][1].body.received_on, undefined);
});

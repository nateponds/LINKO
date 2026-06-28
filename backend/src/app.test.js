import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

async function request(path, options) {
  const server = createServer(createApp());

  // Port 0 asks Windows to choose any free port, so tests do not fail just
  // because another local dev server is already using port 5000.
  await new Promise((resolve) => server.listen(0, resolve));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await response.json();

  await new Promise((resolve) => server.close(resolve));

  return { body, status: response.status };
}

test("health route reports ok", async () => {
  const response = await request("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("inventory route is scaffolded", async () => {
  const response = await request("/api/inventory");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("supplier route is scaffolded", async () => {
  const response = await request("/api/suppliers");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("mutating placeholder routes return not implemented", async () => {
  const response = await request("/api/inventory", { method: "POST" });

  assert.equal(response.status, 501);
  assert.match(response.body.error.message, /not implemented/i);
});

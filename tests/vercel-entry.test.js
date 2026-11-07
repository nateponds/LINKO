import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import app from "../api/index.js";

test("Vercel entry preserves health, API paths, and authentication", async () => {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${origin}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const missing = await fetch(`${origin}/api/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.path, "/api/missing");

    const protectedRoute = await fetch(`${origin}/api/suppliers`);
    assert.equal(protectedRoute.status, 401);
    assert.match((await protectedRoute.json()).error.message, /authentication required/i);
  } finally {
    server.close();
    await once(server, "close");
  }
});

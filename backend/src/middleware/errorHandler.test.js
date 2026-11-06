import assert from "node:assert/strict";
import test from "node:test";
import { errorHandler } from "./errorHandler.js";

test("server diagnostics omit secrets and tolerate missing or malformed database URLs", (t) => {
  const log = t.mock.method(console, "error", () => {});
  const previousUrl = process.env.DATABASE_URL;
  const error = Object.assign(new Error("private error-message-secret"), {
    code: "ENOTFOUND", hostname: "db.example.test",
    query: "private-sql-secret",
  });
  let status;
  let payload;
  const response = {
    status(value) { status = value; return this; },
    json(value) { payload = value; },
  };
  try {
    for (const url of [
      "postgres://testuser:password-secret@db.example.test:6543/private-db?token=query-secret",
      "malformed-url-secret",
      undefined,
    ]) {
      if (url === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = url;

      errorHandler(error, { body: { password: "request-secret" } }, response, () => {});

      assert.equal(status, 500);
      assert.deepEqual(payload, { error: { message: "Internal server error" } });
      const [label, details] = log.mock.calls.at(-1).arguments;
      assert.equal(label, "Unhandled API error");
      assert.deepEqual(details, {
        name: "Error", code: "ENOTFOUND", hostname: "db.example.test",
        databaseEndpoint: url?.startsWith("postgres:")
          ? { host: "db.example.test", port: "6543", user: "testuser" }
          : undefined,
      });
    }
    assert.equal(log.mock.calls.length, 3);
    assert.doesNotMatch(JSON.stringify(log.mock.calls), /secret|private-db/);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});

test("expected client errors preserve their response without server diagnostics", (t) => {
  const log = t.mock.method(console, "error", () => {});
  const response = {
    status(value) { assert.equal(value, 400); return this; },
    json(value) { assert.deepEqual(value, { error: { message: "Invalid input" } }); },
  };
  errorHandler(Object.assign(new Error("Invalid input"), { statusCode: 400 }), {}, response, () => {});
  assert.equal(log.mock.calls.length, 0);
});

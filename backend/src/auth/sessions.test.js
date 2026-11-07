import assert from "node:assert/strict";
import test from "node:test";
import { destroySession, getSessionUser } from "./sessions.js";

test("missing session tokens need no database configuration", async () => {
  const previousUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.equal(await getSessionUser(undefined), null);
    assert.equal(await getSessionUser(""), null);
    assert.equal(await destroySession(undefined), undefined);
    assert.equal(await destroySession(""), undefined);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeConfig } from "../src/index.ts";

test("database configuration fails closed", () => {
  assert.throws(() => loadRuntimeConfig("api", {}), /DATABASE_URL is required/);
});

test("runtime defaults are local and non-secret", () => {
  const config = loadRuntimeConfig("worker", { DATABASE_URL: "postgresql://localhost/dashboard_test" });
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4001);
  assert.equal(config.database.poolMax, 10);
});

test("invalid bounded settings are rejected", () => {
  assert.throws(() => loadRuntimeConfig("api", { DATABASE_URL: "postgresql://localhost/test", PORT: "70000" }), /PORT/);
});

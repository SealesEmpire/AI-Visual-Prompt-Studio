import assert from "node:assert/strict";
import { test } from "node:test";
import process from "node:process";
import { getConfigurationStatus } from "../../lib/config/server-config.ts";

test("server configuration returns explicit missing, partial, invalid, and configured states", () => {
  const original = Object.fromEntries([
    "NEXTAUTH_URL",
    "GENERATION_WORKER_URL",
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "ENCRYPTION_KEY",
    "GENERATION_WORKER_SECRET",
  ].map((key) => [key, process.env[key]]));
  try {
    for (const key of Object.keys(original)) delete process.env[key];
    assert.equal(getConfigurationStatus("database").state, "NOT_CONFIGURED");
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    assert.equal(getConfigurationStatus("application").state, "PARTIALLY_CONFIGURED");
    process.env.GENERATION_WORKER_URL = "http://localhost:3000";
    assert.equal(getConfigurationStatus("application").state, "CONFIGURED");
    process.env.DATABASE_URL = "******host/db";
    assert.equal(getConfigurationStatus("database").state, "INVALID");
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.GOOGLE_CLIENT_ID = "test-client";
    assert.equal(getConfigurationStatus("authentication").state, "INVALID");
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    assert.equal(getConfigurationStatus("authentication").state, "CONFIGURED");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

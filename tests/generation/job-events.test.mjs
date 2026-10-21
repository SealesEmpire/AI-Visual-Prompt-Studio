import assert from "node:assert/strict";
import test from "node:test";
import { toGenerationJobEvent } from "../../lib/generation/job-events.ts";

test("maps a persisted transition into the public event contract", () => {
  assert.deepEqual(
    toGenerationJobEvent({
      id: "42",
      previous_status: "QUEUED",
      status: "SUBMITTING",
      error_code: null,
      created_at: new Date("2026-10-21T03:30:00.000Z"),
      owner_id: "must-not-be-exposed",
      private_metadata: "must-not-be-exposed",
    }),
    {
      id: "42",
      previousStatus: "QUEUED",
      status: "SUBMITTING",
      errorCode: null,
      occurredAt: "2026-10-21T03:30:00.000Z",
    },
  );
});

test("maps initial job events with no previous state", () => {
  assert.equal(
    toGenerationJobEvent({
      id: "1",
      previous_status: null,
      status: "QUEUED",
      error_code: null,
      created_at: "2026-10-21T03:30:00.000Z",
    }).previousStatus,
    null,
  );
});

test("returns only a safe failure code", () => {
  assert.equal(
    toGenerationJobEvent({
      id: "43",
      previous_status: "SUBMITTING",
      status: "FAILED",
      error_code: "RUNPOD_SUBMISSION_HTTP_503",
      created_at: "2026-10-21T03:30:00.000Z",
    }).errorCode,
    "RUNPOD_SUBMISSION_HTTP_503",
  );
});

test("rejects invalid job event data", () => {
  assert.throws(
    () => toGenerationJobEvent({
      id: "42",
      previous_status: "QUEUED",
      status: "BILLED",
      error_code: null,
      created_at: "2026-10-21T03:30:00.000Z",
    }),
    { message: "INVALID_GENERATION_JOB_EVENT" },
  );
  assert.throws(
    () => toGenerationJobEvent({
      id: "42",
      previous_status: "SUBMITTING",
      status: "FAILED",
      error_code: "provider token leaked",
      created_at: "2026-10-21T03:30:00.000Z",
    }),
    { message: "INVALID_GENERATION_JOB_EVENT" },
  );
});

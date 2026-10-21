import assert from "node:assert/strict";
import test from "node:test";
import { toGenerationJobEvent } from "../../lib/generation/job-events.ts";

test("maps a persisted transition into the public event contract", () => {
  assert.deepEqual(
    toGenerationJobEvent({
      id: "42",
      previous_status: "QUEUED",
      status: "SUBMITTING",
      created_at: new Date("2026-10-21T03:30:00.000Z"),
      owner_id: "must-not-be-exposed",
      private_metadata: "must-not-be-exposed",
    }),
    {
      id: "42",
      previousStatus: "QUEUED",
      status: "SUBMITTING",
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
      created_at: "2026-10-21T03:30:00.000Z",
    }).previousStatus,
    null,
  );
});

test("rejects invalid job event data", () => {
  assert.throws(
    () => toGenerationJobEvent({
      id: "42",
      previous_status: "QUEUED",
      status: "BILLED",
      created_at: "2026-10-21T03:30:00.000Z",
    }),
    { message: "INVALID_GENERATION_JOB_EVENT" },
  );
});

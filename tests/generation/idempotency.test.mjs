import assert from "node:assert/strict";
import test from "node:test";
import { createGenerationRequestFingerprint } from "../../lib/generation/idempotency.ts";

test("generation fingerprints are stable across object property ordering", () => {
  const first = {
    providerId: "openai-image",
    prompt: "A studio portrait",
    referenceAsset: { id: "asset-1", mimeType: "image/png" },
  };
  const reordered = {
    referenceAsset: { mimeType: "image/png", id: "asset-1" },
    prompt: "A studio portrait",
    providerId: "openai-image",
  };

  assert.equal(
    createGenerationRequestFingerprint(first),
    createGenerationRequestFingerprint(reordered),
  );
});

test("generation fingerprints differ when any request value changes", () => {
  assert.notEqual(
    createGenerationRequestFingerprint({ prompt: "Portrait", seed: 1 }),
    createGenerationRequestFingerprint({ prompt: "Portrait", seed: 2 }),
  );
});

test("generation fingerprints are SHA-256 hex digests", () => {
  const fingerprint = createGenerationRequestFingerprint({ prompt: "Portrait" });

  assert.match(fingerprint, /^[a-f0-9]{64}$/);
});

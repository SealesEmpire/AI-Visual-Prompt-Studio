import assert from "node:assert/strict";
import test from "node:test";
import { createModelCapabilityRecord } from "../../lib/providers/model-capability.ts";

const imageCapabilities = {
  imageGeneration: true,
  imageEditing: false,
  textToVideo: false,
  imageToVideo: false,
  videoToVideo: false,
  lora: false,
  multipleLoras: false,
  seed: false,
  negativePrompt: false,
  referenceImage: false,
  supportedResolutions: ["1024x1024"],
};

test("creates a declared model record without claiming generation verification", () => {
  const record = createModelCapabilityRecord({
    providerId: "openai",
    modelId: "configured-image-model",
    adapterVersion: "1",
    capabilities: imageCapabilities,
    verificationStatus: "DECLARED",
    inputFormats: ["text"],
    outputFormats: ["image/png"],
    maximumReferenceCount: 0,
    supportsMask: false,
  });

  assert.equal(record.verificationStatus, "DECLARED");
  assert.equal(record.verifiedAt, null);
  assert.deepEqual(record.supportedOperations, ["image_generation"]);
  assert.equal(record.maximumReferenceCount, 0);
  assert.equal(record.supportsMask, false);
});

test("keeps unknown capability details null instead of guessing", () => {
  const record = createModelCapabilityRecord({
    providerId: "runpod-wan",
    modelId: "wan-endpoint-model",
    adapterVersion: "1",
    capabilities: null,
    verificationStatus: "UNKNOWN",
  });

  assert.equal(record.supportedOperations, null);
  assert.equal(record.inputFormats, null);
  assert.equal(record.maximumReferenceCount, null);
  assert.equal(record.supportsSeed, null);
  assert.equal(record.verifiedAt, null);
});

test("requires a timestamp before a capability may be marked verified", () => {
  assert.throws(
    () => createModelCapabilityRecord({
      providerId: "openai",
      modelId: "configured-image-model",
      adapterVersion: "1",
      capabilities: imageCapabilities,
      verificationStatus: "VERIFIED",
    }),
    { message: "VERIFIED_CAPABILITY_REQUIRES_TIMESTAMP" },
  );
  assert.throws(
    () => createModelCapabilityRecord({
      providerId: "openai",
      modelId: "configured-image-model",
      adapterVersion: "1",
      capabilities: imageCapabilities,
      verificationStatus: "VERIFIED",
      verifiedAt: "not-a-timestamp",
    }),
    { message: "VERIFIED_CAPABILITY_REQUIRES_TIMESTAMP" },
  );
});

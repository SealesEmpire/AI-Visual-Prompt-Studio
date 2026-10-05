import assert from "node:assert/strict";
import { test } from "node:test";
import { GenerationRequestBuilder } from "../../lib/generation/request-builder.ts";

const builder = new GenerationRequestBuilder();

test("normalizes requests with known media-compatible presets and variant metadata", () => {
  const request = builder.build({
    mediaType: "video",
    prompt: "  A cinematic sequence  ",
    presetIds: ["JFJ Deepthroat"],
    seed: 42,
    duration: 5,
  });
  assert.equal(request.prompt, "A cinematic sequence");
  assert.deepEqual(request.presetVariants, { "JFJ Deepthroat": "high" });
  assert.equal(request.duration, 5);
});

test("rejects unknown and media-incompatible preset identifiers", () => {
  assert.throws(
    () => builder.build({ mediaType: "image", prompt: "scene", presetIds: ["made-up"] }),
    /Unknown preset/,
  );
  assert.throws(
    () => builder.build({ mediaType: "image", prompt: "scene", presetIds: ["BBC Deepthroat"] }),
    /incompatible/,
  );
});

test("rejects invented variants, unconfigured strength, and invalid dimensions", () => {
  assert.throws(
    () => builder.build({ mediaType: "video", prompt: "scene", presetIds: ["JFJ Deepthroat"], presetVariants: { "JFJ Deepthroat": "low" } }),
    /Invalid variant/,
  );
  assert.throws(
    () => builder.build({ mediaType: "video", prompt: "scene", presetIds: ["JFJ Deepthroat"], presetStrengths: { "JFJ Deepthroat": 0.8 } }),
    /Strength is not configured/,
  );
  assert.throws(
    () => builder.build({ mediaType: "image", prompt: "scene", presetIds: [], width: -1 }),
    /Invalid width/,
  );
});

test("requires a prompt, valid media type, and preset identifier array", () => {
  assert.throws(() => builder.build({ mediaType: "image", prompt: "  ", presetIds: [] }), /Invalid generation request/);
  assert.throws(() => builder.build({ mediaType: "audio", prompt: "scene", presetIds: [] }), /Invalid generation request/);
  assert.doesNotThrow(() => builder.build({ mediaType: "image", prompt: "scene", presetIds: [] }));
});

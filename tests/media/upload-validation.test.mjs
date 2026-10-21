import assert from "node:assert/strict";
import { test } from "node:test";
import { hasAllowedMediaNameAndType, hasValidMediaSignature } from "../../lib/media/upload-validation.ts";

test("allows expected media extensions only with matching MIME types", () => {
  assert.equal(hasAllowedMediaNameAndType("image.JPG", "image/jpeg"), true);
  assert.equal(hasAllowedMediaNameAndType("clip.mp4", "video/mp4"), true);
  assert.equal(hasAllowedMediaNameAndType("image.png", "image/jpeg"), false);
  assert.equal(hasAllowedMediaNameAndType("../image.png", "image/png"), false);
  assert.equal(hasAllowedMediaNameAndType("a".repeat(256) + ".png", "image/png"), false);
});

test("checks signatures for supported images and video containers", () => {
  assert.equal(hasValidMediaSignature(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"), true);
  assert.equal(hasValidMediaSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0]), "image/jpeg"), true);
  assert.equal(hasValidMediaSignature(asciiBytes("RIFFxxxxWEBP"), "image/webp"), true);
  assert.equal(hasValidMediaSignature(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), "video/webm"), true);
  assert.equal(hasValidMediaSignature(asciiBytes("xxxxftyp"), "video/mp4"), false);
  assert.equal(hasValidMediaSignature(asciiBytes("xxxxftypisom"), "video/mp4"), true);
});

function asciiBytes(value) {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

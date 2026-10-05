import assert from "node:assert/strict";
import { test } from "node:test";
import { validateGeneratedAsset } from "../../lib/media/generated-asset-validation.ts";

test("rejects invalid image and video container bytes before persistence", async () => {
  await assert.rejects(
    validateGeneratedAsset(new Uint8Array([1, 2, 3]), "image/png", "image"),
    /GENERATED_IMAGE_CONTAINER_INVALID/,
  );
  await assert.rejects(
    validateGeneratedAsset(new Uint8Array([1, 2, 3]), "video/mp4", "video"),
    /GENERATED_VIDEO_CONTAINER_INVALID/,
  );
});

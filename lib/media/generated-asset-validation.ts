import "server-only";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export async function validateGeneratedAsset(
  bytes: Uint8Array,
  mimeType: string,
  mediaType: "image" | "video",
): Promise<void> {
  if (mediaType === "image") {
    const valid = mimeType === "image/png"
      ? startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])
      : mimeType === "image/jpeg"
        ? startsWith(bytes, [255, 216, 255])
        : mimeType === "image/webp"
          ? ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP"
          : false;
    if (!valid) throw new Error("GENERATED_IMAGE_CONTAINER_INVALID");
    await probe(bytes, ["-show_entries", "stream=width,height", "-of", "json"], (stdout) => {
      const parsed: unknown = JSON.parse(stdout);
      return isRecord(parsed) && Array.isArray(parsed.streams) && parsed.streams.some((stream) =>
        isRecord(stream) && Number.isInteger(stream.width) && Number.isInteger(stream.height) &&
        Number(stream.width) > 0 && Number(stream.height) > 0,
      );
    }, "GENERATED_IMAGE_VALIDATION_FAILED");
    return;
  }

  const validVideoContainer = mimeType === "video/webm"
    ? startsWith(bytes, [26, 69, 223, 163])
    : (mimeType === "video/mp4" || mimeType === "video/quicktime") && ascii(bytes, 4, 8) === "ftyp";
  if (!validVideoContainer) throw new Error("GENERATED_VIDEO_CONTAINER_INVALID");
  await probe(bytes, [
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
  ], (stdout) => {
    const duration = Number(stdout.trim());
    return Number.isFinite(duration) && duration > 0;
  }, "GENERATED_VIDEO_DURATION_INVALID");
}

async function probe(
  bytes: Uint8Array,
  outputOptions: string[],
  validateOutput: (stdout: string) => boolean,
  invalidOutputError: string,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "aivps-ffprobe-"));
  const path = join(directory, "asset");
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    let stdout: string;
    try {
      ({ stdout } = await execFile("ffprobe", [
        "-v", "error",
        "-protocol_whitelist", "file",
        ...outputOptions,
        path,
      ], { timeout: 20_000, maxBuffer: 1024, encoding: "utf8" }));
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") throw new Error("ASSET_VALIDATOR_NOT_CONFIGURED");
      throw new Error("GENERATED_ASSET_VALIDATION_FAILED");
    }
    let valid = false;
    try {
      valid = validateOutput(stdout);
    } catch {
      valid = false;
    }
    if (!valid) throw new Error(invalidOutputError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function startsWith(value: Uint8Array, signature: number[]): boolean {
  return value.length >= signature.length && signature.every((byte, index) => value[index] === byte);
}

function ascii(value: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...value.slice(start, end));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { getPostgresPool } from "@/lib/database/postgres";
import { testOpenAIConnection } from "@/lib/providers/openai";
import { runPodConfigurationFromEnvironment, RunPodWanProvider } from "@/lib/providers/runpod";
import { assetStorageProvider } from "@/lib/storage/s3";

const requiredTables = [
  "users", "projects", "media_assets", "visual_analyses", "prompt_artifacts",
  "generation_jobs", "generation_configurations", "preset_favorites",
  "preset_recents", "provider_metadata", "asset_delivery_jobs",
];

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  let input: unknown;
  try {
    input = await request.json() as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_DIAGNOSTIC_REQUEST" }, { status: 400 });
  }
  if (!isRecord(input) || !["openai", "runpod", "storage", "database"].includes(String(input.target))) {
    return NextResponse.json({ error: "INVALID_DIAGNOSTIC_REQUEST" }, { status: 400 });
  }

  try {
    switch (input.target) {
      case "openai": {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return result("NOT CONFIGURED", "OpenAI API key is not configured.");
        const { modelCount } = await testOpenAIConnection(apiKey);
        return result("PASS", `Authenticated with OpenAI; discovered ${modelCount} models.`);
      }
      case "runpod": {
        const configuration = runPodConfigurationFromEnvironment();
        if (!configuration) return result("NOT CONFIGURED", "RunPod endpoint configuration is incomplete or invalid.");
        const provider = new RunPodWanProvider(configuration);
        const health = await provider.discover();
        return health.available
          ? result("PASS", "RunPod endpoint health check succeeded.")
          : result("FAIL", "RunPod endpoint reported unavailable.");
      }
      case "storage": {
        if (!isStorageConfigured()) return result("NOT CONFIGURED", "S3-compatible object storage is not fully configured.");
        await assetStorageProvider().testConnection(user.id);
        return result("PASS", "Bucket access, upload, HEAD, signed read, byte verification, and cleanup succeeded.");
      }
      case "database": {
        const pool = getPostgresPool();
        if (!pool) return result("NOT CONFIGURED", "DATABASE_URL is not configured.");
        await pool.query("SELECT 1");
        const tableNames = await pool.query(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
          [requiredTables],
        );
        const migrationTable = await pool.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
        let migrationVersion: string | null = null;
        if (migrationTable.rows[0]?.exists) {
          const version = await pool.query("SELECT version FROM schema_migrations WHERE version = '001_phase3'");
          migrationVersion = version.rows[0]?.version ?? null;
        }
        const tables = new Set(tableNames.rows.map((row) => row.tablename));
        const missing = requiredTables.filter((name) => !tables.has(name));
        const passed = missing.length === 0 && migrationVersion === "001_phase3";
        return result(
          passed ? "PASS" : "FAIL",
          passed
            ? "Database connected; migration 001_phase3 and required tables verified."
            : `Database connected; migration ${migrationVersion ?? "pending"}; missing tables: ${missing.join(", ") || "none"}.`,
        );
      }
    }
  } catch (error) {
    return result("FAIL", sanitizeError(error));
  }
}

function result(status: "PASS" | "FAIL" | "NOT CONFIGURED", message: string) {
  return NextResponse.json({ status, message });
}

function sanitizeError(error: unknown): string {
  if (!(error instanceof Error)) return "Diagnostic operation failed.";
  const safeMessage = error.message
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[provider URL]")
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[redacted]@");
  return safeMessage.match(/^[A-Z0-9_:-]{1,160}$/) ? safeMessage : "Diagnostic operation failed; inspect server logs.";
}

function isStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
    process.env.S3_REGION &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

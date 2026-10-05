import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured.");
  process.exit(2);
}

const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
const migrations = ["001_phase3", "002_generation_queue"];
const requiredTables = [
  "users", "projects", "media_assets", "visual_analyses", "prompt_artifacts",
  "generation_jobs", "generation_configurations", "preset_favorites",
  "preset_recents", "provider_metadata", "asset_delivery_jobs",
];

try {
  await pool.query("SELECT 1");
  if (process.argv.includes("--status")) {
    const exists = await pool.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
    const status = exists.rows[0].exists
      ? await pool.query("SELECT version, applied_at FROM schema_migrations WHERE version = ANY($1::text[]) ORDER BY version", [migrations])
      : { rows: [] };
    const applied = new Set(status.rows.map((row) => row.version));
    const pending = migrations.filter((item) => !applied.has(item));
    console.log(JSON.stringify({ connected: true, applied: status.rows, pending }));
    process.exitCode = pending.length === 0 ? 0 : 1;
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ai-visual-prompt-studio-migrations'))");
      await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
      for (const version of migrations) {
        const applied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
        if (applied.rowCount === 0) {
          const existing = await client.query(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
            [requiredTables],
          );
          if (version === "001_phase3" && existing.rows.length > 0) {
            throw new Error(`Existing application tables require manual schema review; refusing migration: ${existing.rows.map((row) => row.tablename).join(", ")}`);
          }
          const migrationSql = await readFile(new URL(`../db/migrations/${version}.sql`, import.meta.url), "utf8");
          await client.query(migrationSql);
          if (version === "001_phase3") await verifySchema(client);
          if (version === "002_generation_queue") await verifyQueueSchema(client);
          await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        } else if (version === "001_phase3") {
          await verifySchema(client);
        } else {
          await verifyQueueSchema(client);
        }
      }
      await client.query("COMMIT");
      console.log(`Migrations ${migrations.join(", ")} are applied and verified.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function verifySchema(client) {
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
    [requiredTables],
  );
  const found = new Set(tables.rows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((table) => !found.has(table));
  if (missingTables.length) throw new Error(`Required tables missing: ${missingTables.join(", ")}`);

  const ownership = await client.query(
    "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'owner_id' AND table_name = ANY($1::text[])",
    [["projects", "media_assets", "visual_analyses", "prompt_artifacts", "generation_jobs", "generation_configurations", "preset_favorites", "preset_recents", "asset_delivery_jobs"]],
  );
  if (ownership.rows.length !== 9) throw new Error("Ownership columns are missing from one or more persisted tables.");

  const indexes = await client.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])",
    [["generation_jobs_owner_created_idx", "projects_owner_updated_idx", "media_assets_owner_created_idx"]],
  );
  if (indexes.rows.length !== 3) throw new Error("One or more required indexes are missing.");

  const foreignKeys = await client.query(
    "SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])",
    [["media_assets_generation_job_id_fkey", "generation_configurations_generation_job_id_fkey"]],
  );
  if (foreignKeys.rows.length < 2) throw new Error("Required generation foreign keys are missing.");
}

async function verifyQueueSchema(client) {
  const columns = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'generation_jobs' AND column_name = ANY($1::text[])",
    [["attempt_count", "next_retry_at", "locked_at", "locked_by"]],
  );
  if (columns.rows.length !== 4) throw new Error("Generation queue columns are missing.");
  const queueIndex = await client.query(
    "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'generation_jobs_queue_idx'",
  );
  if (!queueIndex.rows[0]) throw new Error("Generation queue index is missing.");
  const required = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
    [["user_storage_connections", "api_rate_limits"]],
  );
  if (required.rows.length !== 2) throw new Error("User storage or API rate-limit tables are missing.");
  const storageColumns = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_storage_connections' AND column_name = ANY($1::text[])",
    [["credentials_encrypted", "credential_iv", "credential_tag", "owner_id"]],
  );
  if (storageColumns.rows.length !== 4) throw new Error("Encrypted user storage connection fields are missing.");
}

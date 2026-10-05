import "server-only";
import type { GenerationJob } from "@/types/application";
import { getPostgresPool } from "@/lib/database/postgres";

export interface GenerationJobRepository {
  create(userId: string, job: GenerationJob, idempotencyKey?: string): Promise<GenerationJob>;
  get(userId: string, jobId: string): Promise<GenerationJob | null>;
  list(userId: string): Promise<GenerationJob[]>;
  save(userId: string, job: GenerationJob): Promise<void>;
}

export class PostgresGenerationJobRepository implements GenerationJobRepository {
  async create(userId: string, job: GenerationJob, idempotencyKey?: string): Promise<GenerationJob> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    requireUuid(userId, "userId");
    const result = await pool.query(
      `INSERT INTO generation_jobs
        (id, owner_id, provider_id, provider_job_id, status, configuration, result_asset, progress, error, idempotency_key, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
       ON CONFLICT (owner_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        job.id,
        userId,
        job.providerId ?? null,
        job.providerJobId ?? null,
        job.status,
        JSON.stringify(job.configuration),
        job.resultAsset ? JSON.stringify(job.resultAsset) : null,
        job.progress ?? null,
        job.error ?? null,
        idempotencyKey ?? null,
        job.retryCount ?? 0,
      ],
    );
    let savedRow = result.rows[0];
    if (!savedRow && idempotencyKey) {
      const existing = await pool.query(
        "SELECT * FROM generation_jobs WHERE owner_id = $1 AND idempotency_key = $2",
        [userId, idempotencyKey],
      );
      savedRow = existing.rows[0];
    }
    if (!savedRow) throw new Error("GENERATION_JOB_INSERT_FAILED");
    const savedJob = rowToJob(savedRow);
    await pool.query(
      `INSERT INTO generation_configurations (owner_id, project_id, generation_job_id, configuration)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (generation_job_id) DO UPDATE
       SET configuration = EXCLUDED.configuration
       WHERE generation_configurations.owner_id = EXCLUDED.owner_id`,
      [userId, savedJob.configuration.projectId ?? null, savedJob.id, JSON.stringify(savedJob.configuration)],
    );
    if (savedJob.configuration.projectId) {
      await pool.query(
        `UPDATE projects
         SET payload = jsonb_set(
           payload, '{generationConfigurations}',
           COALESCE(payload->'generationConfigurations', '[]'::jsonb) || $3::jsonb,
           true
         ), updated_at = now()
         WHERE id = $1 AND owner_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'generationConfigurations', '[]'::jsonb)) AS item
             WHERE item->>'jobId' = $4
           )`,
        [
          savedJob.configuration.projectId,
          userId,
          JSON.stringify([{ jobId: savedJob.id, ...savedJob.configuration }]),
          savedJob.id,
        ],
      );
    }
    return savedJob;
  }

  async get(userId: string, jobId: string): Promise<GenerationJob | null> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    requireUuid(userId, "userId");
    const result = await pool.query(
      "SELECT * FROM generation_jobs WHERE owner_id = $1 AND id = $2",
      [userId, jobId],
    );
    return result.rows[0] ? rowToJob(result.rows[0]) : null;
  }

  async list(userId: string): Promise<GenerationJob[]> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    requireUuid(userId, "userId");
    const result = await pool.query(
      "SELECT * FROM generation_jobs WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100",
      [userId],
    );
    return result.rows.map(rowToJob);
  }

  async save(userId: string, job: GenerationJob): Promise<void> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    requireUuid(userId, "userId");
    const result = await pool.query(
      `UPDATE generation_jobs
       SET provider_id = $3, provider_job_id = $4, status = $5,
           configuration = $6::jsonb, result_asset = $7::jsonb,
           progress = $8, error = $9, retry_count = $10, updated_at = now()
       WHERE owner_id = $1 AND id = $2`,
      [
        userId,
        job.id,
        job.providerId ?? null,
        job.providerJobId ?? null,
        job.status,
        JSON.stringify(job.configuration),
        job.resultAsset ? JSON.stringify(job.resultAsset) : null,
        job.progress ?? null,
        job.error ?? null,
        job.retryCount ?? 0,
      ],
    );
    if (result.rowCount !== 1) throw new Error("GENERATION_JOB_NOT_FOUND");
    if (job.resultAsset) {
      await pool.query(
        `INSERT INTO media_assets
          (id, owner_id, project_id, generation_job_id, type, mime_type, storage_key, size, checksum)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE
         SET storage_key = EXCLUDED.storage_key, size = EXCLUDED.size, checksum = EXCLUDED.checksum
         WHERE media_assets.owner_id = EXCLUDED.owner_id`,
        [
          job.resultAsset.id,
          userId,
          job.configuration.projectId ?? null,
          job.id,
          job.configuration.mediaType,
          job.resultAsset.mimeType,
          job.resultAsset.storageKey,
          job.resultAsset.size,
          job.resultAsset.checksum ?? null,
        ],
      );
      if (job.configuration.projectId) {
        await pool.query(
          `UPDATE projects
           SET payload = jsonb_set(
             payload,
             '{assets}',
             COALESCE(payload->'assets', '[]'::jsonb) || $3::jsonb,
             true
           ), updated_at = now()
           WHERE id = $1 AND owner_id = $2`,
          [job.configuration.projectId, userId, JSON.stringify([job.resultAsset])],
        );
      }
    }
  }
}

function rowToJob(row: Record<string, unknown>): GenerationJob {
  return {
    id: String(row.id),
    providerId: typeof row.provider_id === "string" ? row.provider_id : undefined,
    providerJobId: typeof row.provider_job_id === "string" ? row.provider_job_id : undefined,
    status: row.status as GenerationJob["status"],
    configuration: row.configuration as GenerationJob["configuration"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    ...(typeof row.progress === "number" ? { progress: row.progress } : {}),
    ...(typeof row.error === "string" ? { error: row.error } : {}),
    ...(row.result_asset ? { resultAsset: row.result_asset as GenerationJob["resultAsset"] } : {}),
    ...(typeof row.retry_count === "number" ? { retryCount: row.retry_count } : {}),
  };
}

function requireUuid(value: string, field: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

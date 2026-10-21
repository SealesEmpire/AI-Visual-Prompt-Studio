import "server-only";
import type { GenerationJob } from "@/types/application";
import { getPostgresPool } from "@/lib/database/postgres";
import { assetStorageProvider } from "@/lib/storage/s3";

export interface ClaimedGeneration {
  ownerId: string;
  attemptCount: number;
  workerId: string;
  job: GenerationJob;
}

export class PostgresGenerationQueue {
  async claim(workerId: string): Promise<ClaimedGeneration | null> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE generation_jobs
         SET status = 'FAILED', error = 'WORKER_LEASE_EXPIRED',
             locked_at = NULL, locked_by = NULL, updated_at = now()
         WHERE status = 'SUBMITTING' AND locked_at < now() - interval '5 minutes'`,
      );
      const result = await client.query(
        `SELECT * FROM generation_jobs
         WHERE status IN ('PENDING', 'QUEUED')
           AND next_retry_at <= now()
           AND locked_at IS NULL
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }
      const attemptCount = Number(row.attempt_count ?? 0) + 1;
      await client.query(
        `UPDATE generation_jobs
         SET status = 'SUBMITTING', locked_at = now(), locked_by = $2,
             attempt_count = $3, updated_at = now()
         WHERE id = $1`,
        [row.id, workerId, attemptCount],
      );
      await client.query("COMMIT");
      return {
        ownerId: String(row.owner_id),
        attemptCount,
        workerId,
        job: {
          id: String(row.id),
          providerId: typeof row.provider_id === "string" ? row.provider_id : undefined,
          providerJobId: typeof row.provider_job_id === "string" ? row.provider_job_id : undefined,
          status: "SUBMITTING",
          configuration: row.configuration as GenerationJob["configuration"],
          createdAt: new Date(String(row.created_at)).toISOString(),
          updatedAt: new Date().toISOString(),
          retryCount: Number(row.retry_count ?? 0),
          ...(typeof row.progress === "number" ? { progress: row.progress } : {}),
          ...(typeof row.error === "string" ? { error: row.error } : {}),
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(claim: ClaimedGeneration, job: GenerationJob): Promise<void> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE generation_jobs
         SET provider_id = $4, provider_job_id = $5, status = $6,
             configuration = $7::jsonb, result_asset = $8::jsonb,
             progress = $9, error = $10, retry_count = $11,
             locked_at = NULL, locked_by = NULL, next_retry_at = now(), updated_at = now()
         WHERE id = $1 AND owner_id = $2 AND locked_by = $3 AND status = 'SUBMITTING'
         RETURNING id`,
        [
          job.id,
          claim.ownerId,
          claim.workerId,
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
      if (updated.rowCount !== 1) throw new Error("GENERATION_JOB_NO_LONGER_CLAIMED");
      if (job.resultAsset) {
        await client.query(
          `INSERT INTO media_assets
            (id, owner_id, project_id, generation_job_id, type, mime_type, storage_key, size, checksum)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            job.resultAsset.id,
            claim.ownerId,
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
          await client.query(
            `UPDATE projects
             SET payload = jsonb_set(
               payload, '{assets}',
               COALESCE(payload->'assets', '[]'::jsonb) || $3::jsonb, true
             ), updated_at = now()
             WHERE id = $1 AND owner_id = $2`,
            [job.configuration.projectId, claim.ownerId, JSON.stringify([job.resultAsset])],
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (job.resultAsset?.storageKey) {
        await assetStorageProvider().delete(job.resultAsset.storageKey, claim.ownerId).catch(() => undefined);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async fail(claim: ClaimedGeneration, message: string): Promise<"QUEUED" | "FAILED" | "CANCELLED"> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const retryable = /_(429|5\d\d)$/.test(message);
    const canRetry = retryable && claim.attemptCount < 4;
    const status = canRetry ? "QUEUED" : "FAILED";
    const delaySeconds = Math.min(300, 10 * (2 ** Math.max(0, claim.attemptCount - 1)));
    const result = await pool.query(
      `UPDATE generation_jobs
       SET status = $3, error = $4,
           retry_count = retry_count + CASE WHEN $3 = 'QUEUED' THEN 1 ELSE 0 END,
           next_retry_at = CASE WHEN $3 = 'QUEUED' THEN now() + ($5 * interval '1 second') ELSE next_retry_at END,
           locked_at = NULL, locked_by = NULL, updated_at = now()
       WHERE id = $1 AND owner_id = $2 AND locked_by = $6 AND status = 'SUBMITTING'`,
      [claim.job.id, claim.ownerId, status, message.slice(0, 500), delaySeconds, claim.workerId],
    );
    return result.rowCount === 1 ? status : "CANCELLED";
  }
}

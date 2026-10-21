import "server-only";
import type { PromptArtifact } from "@/types/application";
import { getPostgresPool } from "@/lib/database/postgres";
import type { PromptRepository } from "@/lib/storage/repositories";
import {
  createPromptRevisionContent,
  hashPromptRevisionContent,
  toPromptRevision,
  type PromptRevision,
} from "@/lib/prompts/revisions";

export class PostgresPromptRepository implements PromptRepository {
  async list(ownerId: string): Promise<PromptArtifact[]> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const result = await pool.query(
      `SELECT id, project_id, media_asset_id, prompt, goal, analysis, editing_intent, created_at
       FROM prompt_artifacts WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [ownerId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      ...(row.project_id ? { projectId: row.project_id } : {}),
      ...(row.media_asset_id ? { sourceAssetId: row.media_asset_id } : {}),
      prompt: row.prompt,
      ...(row.goal ? { goal: row.goal } : {}),
      createdAt: new Date(row.created_at).toISOString(),
      ...(row.analysis ? { analysis: row.analysis } : {}),
      ...(row.editing_intent ? { editingIntent: row.editing_intent } : {}),
    }));
  }

  async save(ownerId: string, prompt: PromptArtifact): Promise<void> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const saved = await client.query(
        `INSERT INTO prompt_artifacts
          (id, owner_id, project_id, media_asset_id, prompt, goal, analysis, editing_intent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
         ON CONFLICT (id) DO UPDATE
         SET prompt = EXCLUDED.prompt, goal = EXCLUDED.goal,
             analysis = EXCLUDED.analysis, editing_intent = EXCLUDED.editing_intent,
             project_id = EXCLUDED.project_id, media_asset_id = EXCLUDED.media_asset_id
         WHERE prompt_artifacts.owner_id = EXCLUDED.owner_id
         RETURNING id`,
        [
          prompt.id,
          ownerId,
          prompt.projectId ?? null,
          prompt.sourceAssetId ?? null,
          prompt.prompt,
          prompt.goal ?? null,
          prompt.analysis ? JSON.stringify(prompt.analysis) : null,
          prompt.editingIntent ? JSON.stringify(prompt.editingIntent) : null,
          prompt.createdAt,
        ],
      );
      if (!saved.rows[0]) throw new Error("PROMPT_ARTIFACT_NOT_FOUND");

      const content = createPromptRevisionContent(prompt);
      const latest = await client.query(
        `SELECT id, revision, content = $3::jsonb AS identical
         FROM prompt_revisions
         WHERE owner_id = $1 AND prompt_artifact_id = $2
         ORDER BY revision DESC
         LIMIT 1`,
        [ownerId, prompt.id, JSON.stringify(content)],
      );
      const previous = latest.rows[0];
      if (!previous?.identical) {
        await client.query(
          `INSERT INTO prompt_revisions
            (owner_id, editor_id, prompt_artifact_id, revision, parent_revision_id, content, content_hash, created_at)
           VALUES ($1, $1, $2, $3, $4, $5::jsonb, $6, now())`,
          [
            ownerId,
            prompt.id,
            Number(previous?.revision ?? 0) + 1,
            previous?.id ?? null,
            JSON.stringify(content),
            hashPromptRevisionContent(content),
          ],
        );
      }
      if (prompt.projectId) {
        await client.query(
          `UPDATE projects
           SET payload = jsonb_set(
             payload,
             '{prompts}',
             COALESCE(payload->'prompts', '[]'::jsonb) || $3::jsonb,
             true
           ), updated_at = now()
           WHERE id = $1 AND owner_id = $2`,
          [prompt.projectId, ownerId, JSON.stringify([prompt])],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listRevisions(ownerId: string, promptId: string): Promise<PromptRevision[]> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const result = await pool.query(
      `SELECT id::text, editor_id::text, prompt_artifact_id::text, revision, parent_revision_id::text,
              content_hash, content, created_at
       FROM prompt_revisions
       WHERE owner_id = $1 AND prompt_artifact_id = $2
       ORDER BY revision DESC
       LIMIT 100`,
      [ownerId, promptId],
    );
    return result.rows.map((row) => toPromptRevision(row as Record<string, unknown>));
  }
}

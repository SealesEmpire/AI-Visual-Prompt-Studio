import "server-only";
import type { PromptArtifact } from "@/types/application";
import { getPostgresPool } from "@/lib/database/postgres";
import type { PromptRepository } from "@/lib/storage/repositories";

export class PostgresPromptRepository implements PromptRepository {
  async list(ownerId: string): Promise<PromptArtifact[]> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const result = await pool.query(
      `SELECT id, prompt, goal, analysis, editing_intent, created_at
       FROM prompt_artifacts WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [ownerId],
    );
    return result.rows.map((row) => ({
      id: row.id,
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
    await pool.query(
      `INSERT INTO prompt_artifacts
        (id, owner_id, prompt, goal, analysis, editing_intent, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT (id) DO UPDATE
       SET prompt = EXCLUDED.prompt, goal = EXCLUDED.goal,
           analysis = EXCLUDED.analysis, editing_intent = EXCLUDED.editing_intent
       WHERE prompt_artifacts.owner_id = EXCLUDED.owner_id`,
      [
        prompt.id,
        ownerId,
        prompt.prompt,
        prompt.goal ?? null,
        prompt.analysis ? JSON.stringify(prompt.analysis) : null,
        prompt.editingIntent ? JSON.stringify(prompt.editingIntent) : null,
        prompt.createdAt,
      ],
    );
  }
}

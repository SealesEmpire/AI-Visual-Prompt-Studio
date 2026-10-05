import "server-only";
import type { Project } from "@/types/application";
import { getPostgresPool } from "@/lib/database/postgres";
import type { ProjectRepository } from "@/lib/storage/repositories";

export class PostgresProjectRepository implements ProjectRepository {
  async list(ownerId: string): Promise<Project[]> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const result = await pool.query(
      "SELECT id, name, created_at, updated_at, payload FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC",
      [ownerId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      assets: (row.payload?.assets ?? []).map((asset: { id?: string }) => ({
        ...asset,
        ...(asset.id ? { url: `/api/assets/${asset.id}` } : {}),
      })),
      prompts: row.payload?.prompts ?? [],
      generationConfigurations: row.payload?.generationConfigurations ?? [],
    }));
  }

  async save(ownerId: string, project: Project): Promise<void> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    await pool.query(
      `INSERT INTO projects (id, owner_id, name, created_at, updated_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at, payload = EXCLUDED.payload
       WHERE projects.owner_id = EXCLUDED.owner_id`,
      [
        project.id,
        ownerId,
        project.name,
        project.createdAt,
        project.updatedAt,
        JSON.stringify({
          assets: project.assets,
          prompts: project.prompts,
          generationConfigurations: project.generationConfigurations,
        }),
      ],
    );
  }
}

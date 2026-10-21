import "server-only";
import { getPostgresPool } from "@/lib/database/postgres";

export async function checkRateLimit(
  ownerId: string,
  route: string,
  maximum: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
  const result = await pool.query(
    `INSERT INTO api_rate_limits (owner_id, route, window_started_at, request_count)
     VALUES ($1, $2, now(), 1)
     ON CONFLICT (owner_id, route) DO UPDATE
     SET request_count = CASE
           WHEN api_rate_limits.window_started_at <= now() - ($3 * interval '1 second') THEN 1
           ELSE api_rate_limits.request_count + 1
         END,
         window_started_at = CASE
           WHEN api_rate_limits.window_started_at <= now() - ($3 * interval '1 second') THEN now()
           ELSE api_rate_limits.window_started_at
         END
     RETURNING request_count, GREATEST(0, CEIL(EXTRACT(EPOCH FROM (window_started_at + ($3 * interval '1 second') - now()))))::integer AS retry_after`,
    [ownerId, route, windowSeconds],
  );
  const count = Number(result.rows[0].request_count);
  return {
    allowed: count <= maximum,
    retryAfterSeconds: Number(result.rows[0].retry_after),
  };
}

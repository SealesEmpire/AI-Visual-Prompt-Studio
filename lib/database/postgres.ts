import "server-only";
import { Pool } from "pg";

declare global {
  var aiStudioPool: Pool | undefined;
}

export function getPostgresPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  globalThis.aiStudioPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
  });
  return globalThis.aiStudioPool;
}

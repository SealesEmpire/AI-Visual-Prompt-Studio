import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getPostgresPool } from "@/lib/database/postgres";

export interface AuthenticatedUser {
  id: string;
}

export interface AuthService {
  getUser(request: Request): Promise<AuthenticatedUser | null>;
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  void request;
  if (!isAuthenticationConfigured()) return null;
  const session = await getServerSession(authOptions);
  const subject = session?.user?.id;
  const pool = getPostgresPool();
  if (!subject || !pool) return null;
  const result = await pool.query(
    `INSERT INTO users (id, auth_subject)
     VALUES (gen_random_uuid(), $1)
     ON CONFLICT (auth_subject) DO UPDATE SET auth_subject = EXCLUDED.auth_subject
     RETURNING id`,
    [subject],
  );
  const id: unknown = result.rows[0]?.id;
  return typeof id === "string" ? { id } : null;
}

export function isAuthenticationConfigured(): boolean {
  return Boolean(process.env.NEXTAUTH_SECRET && authOptions.providers.length > 0);
}

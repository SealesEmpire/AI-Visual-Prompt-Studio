import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { getPostgresPool } from "@/lib/database/postgres";
import { toGenerationJobEvent } from "@/lib/generation/job-events";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "GENERATION_JOB_NOT_FOUND" }, { status: 404 });

  const url = new URL(request.url);
  const rawCursor = url.searchParams.get("beforeId");
  const rawLimit = url.searchParams.get("limit");
  const cursor = rawCursor === null ? null : parseEventCursor(rawCursor);
  if (
    (rawCursor !== null && cursor === null) ||
    (rawLimit !== null && !/^(?:[1-9]\d?|100)$/.test(rawLimit))
  ) {
    return NextResponse.json({ error: "INVALID_EVENT_PAGE" }, { status: 400 });
  }
  const limit = rawLimit === null ? 50 : Number(rawLimit);

  try {
    const pool = getPostgresPool();
    if (!pool) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
    const job = await pool.query(
      "SELECT 1 FROM generation_jobs WHERE id = $1 AND owner_id = $2",
      [id, user.id],
    );
    if (!job.rows[0]) return NextResponse.json({ error: "GENERATION_JOB_NOT_FOUND" }, { status: 404 });

    const result = await pool.query(
      `SELECT id::text, previous_status, status, created_at
       FROM generation_job_events
       WHERE generation_job_id = $1 AND owner_id = $2
         AND ($3::bigint IS NULL OR id < $3::bigint)
       ORDER BY id DESC
       LIMIT $4`,
      [id, user.id, cursor, limit],
    );
    const events = result.rows.map((row) =>
      toGenerationJobEvent(row as Record<string, unknown>),
    ).reverse();
    return NextResponse.json({
      events,
      nextCursor: events.length === limit ? events[0]?.id ?? null : null,
    });
  } catch {
    return NextResponse.json({ error: "GENERATION_JOB_EVENTS_UNAVAILABLE" }, { status: 503 });
  }
}

function parseEventCursor(value: string): string | null {
  if (!/^[1-9]\d{0,18}$/.test(value)) return null;
  return BigInt(value) <= 9_223_372_036_854_775_807n ? value : null;
}

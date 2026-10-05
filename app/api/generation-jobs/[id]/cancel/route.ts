import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { PostgresGenerationJobRepository } from "@/lib/generation/job-repository";
import { configuredProviderRegistry } from "@/lib/providers/configured";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  const { id } = await params;
  try {
    const repository = new PostgresGenerationJobRepository();
    const job = await repository.get(user.id, id);
    if (!job) return NextResponse.json({ error: "GENERATION_JOB_NOT_FOUND" }, { status: 404 });
    if (["COMPLETE", "FAILED", "CANCELLED"].includes(job.status)) {
      return NextResponse.json({ error: "GENERATION_JOB_NOT_CANCELLABLE" }, { status: 409 });
    }
    if (job.providerJobId) {
      const provider = configuredProviderRegistry().get(job.providerId ?? "");
      if (!provider?.cancel) return NextResponse.json({ error: "PROVIDER_CANCELLATION_UNSUPPORTED" }, { status: 409 });
      await provider.cancel(job.providerJobId);
    }
    const pool = (await import("@/lib/database/postgres")).getPostgresPool();
    if (!pool) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
    const cancelled = { ...job, status: "CANCELLED" as const, updatedAt: new Date().toISOString() };
    const updated = await pool.query(
      `UPDATE generation_jobs
       SET status = 'CANCELLED', locked_at = NULL, locked_by = NULL, updated_at = now()
       WHERE owner_id = $1 AND id = $2 AND status NOT IN ('COMPLETE', 'FAILED', 'CANCELLED')
       RETURNING id`,
      [user.id, id],
    );
    if (updated.rowCount !== 1) return NextResponse.json({ error: "GENERATION_JOB_NOT_CANCELLABLE" }, { status: 409 });
    return NextResponse.json({ job: cancelled });
  } catch {
    return NextResponse.json({ error: "GENERATION_JOB_CANCELLATION_FAILED" }, { status: 502 });
  }
}

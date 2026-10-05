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
    const cancelled = { ...job, status: "CANCELLED" as const, updatedAt: new Date().toISOString() };
    await repository.save(user.id, cancelled);
    return NextResponse.json({ job: cancelled });
  } catch {
    return NextResponse.json({ error: "GENERATION_JOB_CANCELLATION_FAILED" }, { status: 502 });
  }
}

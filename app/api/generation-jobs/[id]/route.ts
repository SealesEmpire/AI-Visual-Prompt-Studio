import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { PostgresGenerationJobRepository } from "@/lib/generation/job-repository";
import { configuredProviderRegistry } from "@/lib/providers/configured";

export async function GET(
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
    if (job.providerJobId && !isTerminal(job.status)) {
      const provider = configuredProviderRegistry().get(job.providerId ?? "");
      if (provider?.getJobStatus) {
        try {
          const providerState = await provider.getJobStatus(job.providerJobId, {
            ownerId: user.id,
            configuration: job.configuration,
          });
          const updated = {
            ...job,
            status: providerState.status,
            progress: providerState.progress,
            resultAsset: providerState.resultAsset,
            error: providerState.error,
            updatedAt: new Date().toISOString(),
          };
          await repository.save(user.id, updated);
          return NextResponse.json({ job: safeJob(updated) });
        } catch {
          return NextResponse.json({ job: safeJob(job), warning: "PROVIDER_STATUS_TEMPORARILY_UNAVAILABLE" });
        }
      }
    }
    return NextResponse.json({ job: safeJob(job) });
  } catch {
    return NextResponse.json({ error: "GENERATION_JOB_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}

function isTerminal(status: string) {
  return status === "COMPLETE" || status === "FAILED" || status === "CANCELLED";
}

function safeJob<T extends { error?: string }>(job: T) {
  const { error, ...safe } = job;
  return { ...safe, ...(error ? { error: sanitizeError(error) } : {}) };
}

function sanitizeError(error: string) {
  return error.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 500);
}

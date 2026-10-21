import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PostgresGenerationQueue } from "@/lib/generation/queue";
import { configuredProviderRegistry } from "@/lib/providers/configured";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const expected = process.env.GENERATION_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || !constantTimeEqual(expected, supplied)) {
    return NextResponse.json({ error: "WORKER_UNAUTHORIZED" }, { status: 401 });
  }
  const queue = new PostgresGenerationQueue();
  let claim;
  try {
    claim = await queue.claim("worker-" + crypto.randomUUID());
  } catch {
    return NextResponse.json({ error: "GENERATION_QUEUE_UNAVAILABLE" }, { status: 503 });
  }
  if (!claim) return NextResponse.json({ claimed: false });

  const provider = configuredProviderRegistry().get(claim.job.providerId ?? "");
  if (!provider) {
    await queue.fail(claim, "GENERATION_PROVIDER_UNAVAILABLE");
    return NextResponse.json({ claimed: true, status: "FAILED", error: "GENERATION_PROVIDER_UNAVAILABLE" });
  }
  try {
    const submitted = await provider.generate(claim.job.configuration, {
      ownerId: claim.ownerId,
      jobId: claim.job.id,
    });
    const job = {
      ...claim.job,
      ...submitted,
      id: claim.job.id,
      providerId: provider.id,
      configuration: claim.job.configuration,
      createdAt: claim.job.createdAt,
      updatedAt: new Date().toISOString(),
      retryCount: claim.job.retryCount,
    };
    await queue.complete(claim, job);
    return NextResponse.json({ claimed: true, status: job.status });
  } catch (error) {
    const message = safeWorkerError(error);
    const status = await queue.fail(claim, message);
    return NextResponse.json({ claimed: true, status, error: message });
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeWorkerError(error: unknown): string {
  if (!(error instanceof Error)) return "GENERATION_PROVIDER_ERROR";
  const message = error.message.replace(/Bearer\s+\S+/gi, "[redacted]");
  return /^[A-Z0-9_:-]{1,160}$/.test(message) ? message : "GENERATION_PROVIDER_ERROR";
}

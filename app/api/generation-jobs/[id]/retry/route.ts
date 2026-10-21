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
    const prior = await repository.get(user.id, id);
    if (!prior) return NextResponse.json({ error: "GENERATION_JOB_NOT_FOUND" }, { status: 404 });
    const retryCount = prior.retryCount ?? 0;
    if (prior.status !== "FAILED" || retryCount >= 3) {
      return NextResponse.json({ error: "GENERATION_JOB_NOT_RETRYABLE" }, { status: 409 });
    }
    const provider = configuredProviderRegistry().get(prior.providerId ?? "");
    if (!provider) return NextResponse.json({ error: "GENERATION_PROVIDER_UNAVAILABLE" }, { status: 503 });
    const createdAt = new Date().toISOString();
    const proposedId = crypto.randomUUID();
    const retry = await repository.create(user.id, {
      id: proposedId,
      status: "PENDING",
      providerId: provider.id,
      configuration: prior.configuration,
      retryCount: retryCount + 1,
      createdAt,
      updatedAt: createdAt,
    }, `${id}:retry:${retryCount + 1}`);
    if (retry.id !== proposedId) {
      return NextResponse.json({ job: retry }, { status: 200 });
    }
    return NextResponse.json({ job: retry }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "GENERATION_RETRY_FAILED" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { PostgresGenerationJobRepository } from "@/lib/generation/job-repository";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  try {
    const jobs = await new PostgresGenerationJobRepository().list(user.id);
    return NextResponse.json({
      jobs: jobs.map(({ error, ...job }) => ({
        ...job,
        ...(error ? { error: error.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 500) } : {}),
      })),
    });
  } catch {
    return NextResponse.json({ error: "GENERATION_HISTORY_UNAVAILABLE" }, { status: 503 });
  }
}

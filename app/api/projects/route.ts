import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { PostgresProjectRepository } from "@/lib/storage/project-repository";
import type { Project } from "@/types/application";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  try {
    const projects = await new PostgresProjectRepository().list(user.id);
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ error: "PROJECT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json() as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.name !== "string" || !body.name.trim() || body.name.length > 160) {
    return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    createdAt: now,
    updatedAt: now,
    assets: [],
    prompts: [],
    generationConfigurations: [],
  };
  try {
    await new PostgresProjectRepository().save(user.id, project);
    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "PROJECT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

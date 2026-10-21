import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { PostgresPromptRepository } from "@/lib/storage/prompt-repository";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "PROMPT_NOT_FOUND" }, { status: 404 });

  try {
    const revisions = await new PostgresPromptRepository().listRevisions(user.id, id);
    if (revisions.length === 0) {
      return NextResponse.json({ error: "PROMPT_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ revisions });
  } catch {
    return NextResponse.json({ error: "PROMPT_REVISION_HISTORY_UNAVAILABLE" }, { status: 503 });
  }
}

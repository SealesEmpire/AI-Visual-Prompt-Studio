import { createHash } from "node:crypto";
import type { PromptArtifact } from "@/types/application";
import { validatePromptQualityEvaluation } from "./quality.ts";

export interface PromptRevisionContent {
  projectId?: string;
  sourceAssetId?: string;
  prompt: string;
  goal?: string;
  analysis?: PromptArtifact["analysis"];
  quality?: PromptArtifact["quality"];
  editingIntent?: PromptArtifact["editingIntent"];
}

export interface PromptRevision {
  id: string;
  editorId: string;
  promptId: string;
  revision: number;
  parentRevisionId: string | null;
  contentHash: string;
  content: PromptRevisionContent;
  createdAt: string;
}

export function createPromptRevisionContent(prompt: PromptArtifact): PromptRevisionContent {
  return {
    ...(prompt.projectId ? { projectId: prompt.projectId } : {}),
    ...(prompt.sourceAssetId ? { sourceAssetId: prompt.sourceAssetId } : {}),
    prompt: prompt.prompt,
    ...(prompt.goal !== undefined ? { goal: prompt.goal } : {}),
    ...(prompt.analysis ? { analysis: prompt.analysis } : {}),
    ...(prompt.quality ? { quality: prompt.quality } : {}),
    ...(prompt.editingIntent ? { editingIntent: prompt.editingIntent } : {}),
  };
}

export function hashPromptRevisionContent(content: PromptRevisionContent): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export function toPromptRevision(row: Record<string, unknown>): PromptRevision {
  const content = typeof row.content === "string" ? JSON.parse(row.content) as unknown : row.content;
  if (
    typeof row.id !== "string" ||
    typeof row.editor_id !== "string" ||
    typeof row.prompt_artifact_id !== "string" ||
    typeof row.revision !== "number" ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    (row.parent_revision_id !== null && typeof row.parent_revision_id !== "string") ||
    typeof row.content_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.content_hash) ||
    !isPromptRevisionContent(content)
  ) {
    throw new Error("INVALID_PROMPT_REVISION");
  }

  const createdAt = new Date(String(row.created_at));
  if (!Number.isFinite(createdAt.getTime())) throw new Error("INVALID_PROMPT_REVISION");
  return {
    id: row.id,
    editorId: row.editor_id,
    promptId: row.prompt_artifact_id,
    revision: row.revision,
    parentRevisionId: row.parent_revision_id as string | null,
    contentHash: row.content_hash,
    content,
    createdAt: createdAt.toISOString(),
  };
}

function isPromptRevisionContent(value: unknown): value is PromptRevisionContent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const content = value as Record<string, unknown>;
  if (typeof content.prompt !== "string") return false;
  if (content.quality !== undefined) {
    try {
      validatePromptQualityEvaluation(content.quality);
    } catch {
      return false;
    }
  }
  return true;
}

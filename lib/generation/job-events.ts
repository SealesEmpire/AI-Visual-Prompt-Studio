import type { GenerationJob } from "@/types/application";

export interface GenerationJobEvent {
  id: string;
  previousStatus: GenerationJob["status"] | null;
  status: GenerationJob["status"];
  occurredAt: string;
}

const jobStatuses = new Set<GenerationJob["status"]>([
  "PENDING",
  "QUEUED",
  "SUBMITTING",
  "GENERATING",
  "PROCESSING",
  "COMPLETE",
  "FAILED",
  "CANCELLED",
]);

export function toGenerationJobEvent(row: Record<string, unknown>): GenerationJobEvent {
  if (
    typeof row.id !== "string" ||
    typeof row.status !== "string" ||
    !jobStatuses.has(row.status as GenerationJob["status"]) ||
    (row.previous_status !== null &&
      (typeof row.previous_status !== "string" ||
        !jobStatuses.has(row.previous_status as GenerationJob["status"])))
  ) {
    throw new Error("INVALID_GENERATION_JOB_EVENT");
  }

  const occurredAt = new Date(String(row.created_at));
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new Error("INVALID_GENERATION_JOB_EVENT");
  }

  return {
    id: row.id,
    previousStatus: row.previous_status as GenerationJob["status"] | null,
    status: row.status as GenerationJob["status"],
    occurredAt: occurredAt.toISOString(),
  };
}

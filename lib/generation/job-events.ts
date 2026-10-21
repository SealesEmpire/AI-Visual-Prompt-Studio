import type { GenerationJob } from "@/types/application";

export interface GenerationJobEvent {
  id: string;
  previousStatus: GenerationJob["status"] | null;
  status: GenerationJob["status"];
  errorCode: string | null;
  occurredAt: string;
}

const safeErrorCodePattern = /^[A-Z0-9_:-]{1,160}$/;

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
  if (
    row.error_code !== null &&
    (typeof row.error_code !== "string" || !safeErrorCodePattern.test(row.error_code))
  ) {
    throw new Error("INVALID_GENERATION_JOB_EVENT");
  }

  return {
    id: row.id,
    previousStatus: row.previous_status as GenerationJob["status"] | null,
    status: row.status as GenerationJob["status"],
    errorCode: row.error_code as string | null,
    occurredAt: occurredAt.toISOString(),
  };
}

export const promptQualityCategories = [
  "clarity",
  "composition",
  "consistency",
  "completeness",
  "modelCompatibility",
] as const;

export type PromptQualityCategory = typeof promptQualityCategories[number];

export interface PromptQualityScore {
  score: number;
  rationale: string;
}

export interface PromptImprovement {
  id: string;
  category: PromptQualityCategory;
  title: string;
  promptAddition: string;
  rationale: string;
}

export interface PromptQualityEvaluation {
  rubricVersion: "1.0";
  scores: Record<PromptQualityCategory, PromptQualityScore>;
  improvements: PromptImprovement[];
}

export function validatePromptQualityEvaluation(value: unknown): PromptQualityEvaluation {
  if (!isRecord(value) || value.rubricVersion !== "1.0" || !isRecord(value.scores)) {
    throw new Error("AI_PROVIDER_INVALID_PROMPT_QUALITY");
  }
  const scores = {} as Record<PromptQualityCategory, PromptQualityScore>;
  for (const category of promptQualityCategories) {
    const score = value.scores[category];
    if (
      !isRecord(score) ||
      typeof score.score !== "number" ||
      !Number.isInteger(score.score) ||
      score.score < 0 ||
      score.score > 100 ||
      !isBoundedString(score.rationale, 1, 500)
    ) {
      throw new Error("AI_PROVIDER_INVALID_PROMPT_QUALITY");
    }
    scores[category] = { score: score.score, rationale: score.rationale };
  }

  if (
    !Array.isArray(value.improvements) ||
    value.improvements.length < 8 ||
    value.improvements.length > 10
  ) {
    throw new Error("AI_PROVIDER_INVALID_PROMPT_IMPROVEMENTS");
  }
  const ids = new Set<string>();
  const improvements = value.improvements.map((item): PromptImprovement => {
    if (
      !isRecord(item) ||
      !isBoundedString(item.id, 1, 80) ||
      ids.has(item.id) ||
      !promptQualityCategories.includes(item.category as PromptQualityCategory) ||
      !isBoundedString(item.title, 1, 120) ||
      !isBoundedString(item.promptAddition, 1, 500) ||
      !isBoundedString(item.rationale, 1, 500)
    ) {
      throw new Error("AI_PROVIDER_INVALID_PROMPT_IMPROVEMENTS");
    }
    ids.add(item.id);
    return {
      id: item.id,
      category: item.category as PromptQualityCategory,
      title: item.title,
      promptAddition: item.promptAddition,
      rationale: item.rationale,
    };
  });
  return { rubricVersion: "1.0", scores, improvements };
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

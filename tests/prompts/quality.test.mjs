import assert from "node:assert/strict";
import test from "node:test";
import { validatePromptQualityEvaluation } from "../../lib/prompts/quality.ts";

function validEvaluation() {
  const scores = Object.fromEntries(
    ["clarity", "composition", "consistency", "completeness", "modelCompatibility"].map((category) => [
      category,
      { score: 80, rationale: `${category} is clear.` },
    ]),
  );
  const improvements = Array.from({ length: 8 }, (_, index) => ({
    id: `improvement-${index + 1}`,
    category: "composition",
    title: `Improvement ${index + 1}`,
    promptAddition: `Add a thoughtful composition detail ${index + 1}`,
    rationale: "This gives the prompt a more actionable direction.",
  }));
  return { rubricVersion: "1.0", scores, improvements };
}

test("validates the five rubric categories and eight independently applicable suggestions", () => {
  const result = validatePromptQualityEvaluation(validEvaluation());
  assert.equal(Object.keys(result.scores).length, 5);
  assert.equal(result.improvements.length, 8);
  assert.equal(result.rubricVersion, "1.0");
});

test("rejects missing rubric scores and out-of-range scores", () => {
  const missing = validEvaluation();
  delete missing.scores.clarity;
  assert.throws(() => validatePromptQualityEvaluation(missing), {
    message: "AI_PROVIDER_INVALID_PROMPT_QUALITY",
  });

  const outOfRange = validEvaluation();
  outOfRange.scores.clarity.score = 101;
  assert.throws(() => validatePromptQualityEvaluation(outOfRange), {
    message: "AI_PROVIDER_INVALID_PROMPT_QUALITY",
  });
});

test("rejects an incorrect suggestion count and duplicate suggestion IDs", () => {
  const tooFew = validEvaluation();
  tooFew.improvements.pop();
  assert.throws(() => validatePromptQualityEvaluation(tooFew), {
    message: "AI_PROVIDER_INVALID_PROMPT_IMPROVEMENTS",
  });

  const duplicate = validEvaluation();
  duplicate.improvements[1].id = duplicate.improvements[0].id;
  assert.throws(() => validatePromptQualityEvaluation(duplicate), {
    message: "AI_PROVIDER_INVALID_PROMPT_IMPROVEMENTS",
  });
});

test("rejects malformed or oversized recommendation fields", () => {
  const invalid = validEvaluation();
  invalid.improvements[0].promptAddition = "   ";
  assert.throws(() => validatePromptQualityEvaluation(invalid), {
    message: "AI_PROVIDER_INVALID_PROMPT_IMPROVEMENTS",
  });
});

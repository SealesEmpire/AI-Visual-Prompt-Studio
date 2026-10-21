import assert from "node:assert/strict";
import test from "node:test";
import {
  createPromptRevisionContent,
  hashPromptRevisionContent,
  toPromptRevision,
} from "../../lib/prompts/revisions.ts";

test("revision content is a snapshot of prompt fields without mutable IDs", () => {
  const prompt = {
    id: "prompt-id",
    projectId: "project-id",
    sourceAssetId: "asset-id",
    prompt: "A cinematic scene",
    goal: "Create a film still",
    createdAt: "2026-10-21T03:00:00.000Z",
  };

  assert.deepEqual(createPromptRevisionContent(prompt), {
    projectId: "project-id",
    sourceAssetId: "asset-id",
    prompt: "A cinematic scene",
    goal: "Create a film still",
  });
});

test("revision hashes are stable and change when content changes", () => {
  const content = createPromptRevisionContent({
    id: "prompt-id",
    prompt: "A cinematic scene",
    createdAt: "2026-10-21T03:00:00.000Z",
  });
  assert.equal(hashPromptRevisionContent(content), hashPromptRevisionContent(content));
  assert.notEqual(
    hashPromptRevisionContent(content),
    hashPromptRevisionContent({ ...content, prompt: "A different scene" }),
  );
});

test("maps revision history while validating immutable revision metadata", () => {
  assert.deepEqual(
    toPromptRevision({
      id: "revision-id",
      editor_id: "editor-id",
      prompt_artifact_id: "prompt-id",
      revision: 2,
      parent_revision_id: "parent-id",
      content_hash: "a".repeat(64),
      content: { prompt: "Second version" },
      created_at: "2026-10-21T03:30:00.000Z",
      owner_id: "not-exposed",
    }),
    {
      id: "revision-id",
      editorId: "editor-id",
      promptId: "prompt-id",
      revision: 2,
      parentRevisionId: "parent-id",
      contentHash: "a".repeat(64),
      content: { prompt: "Second version" },
      createdAt: "2026-10-21T03:30:00.000Z",
    },
  );
  assert.throws(
    () => toPromptRevision({
      id: "revision-id",
      prompt_artifact_id: "prompt-id",
      revision: 0,
      parent_revision_id: null,
      content_hash: "invalid",
      content: { prompt: "invalid" },
      created_at: "invalid",
    }),
    { message: "INVALID_PROMPT_REVISION" },
  );
});

CREATE TABLE IF NOT EXISTS prompt_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  editor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_artifact_id uuid NOT NULL REFERENCES prompt_artifacts(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  parent_revision_id uuid REFERENCES prompt_revisions(id) ON DELETE SET NULL,
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, prompt_artifact_id, revision)
);

CREATE INDEX IF NOT EXISTS prompt_revisions_owner_artifact_idx
  ON prompt_revisions (owner_id, prompt_artifact_id, revision DESC);

INSERT INTO prompt_revisions (
  owner_id, editor_id, prompt_artifact_id, revision, parent_revision_id, content, content_hash, created_at
)
SELECT
  artifact.owner_id,
  artifact.owner_id,
  artifact.id,
  1,
  NULL,
  jsonb_strip_nulls(jsonb_build_object(
    'projectId', artifact.project_id,
    'sourceAssetId', artifact.media_asset_id,
    'prompt', artifact.prompt,
    'goal', artifact.goal,
    'analysis', artifact.analysis,
    'editingIntent', artifact.editing_intent
  )),
  encode(digest(
    jsonb_strip_nulls(jsonb_build_object(
      'projectId', artifact.project_id,
      'sourceAssetId', artifact.media_asset_id,
      'prompt', artifact.prompt,
      'goal', artifact.goal,
      'analysis', artifact.analysis,
      'editingIntent', artifact.editing_intent
    ))::text,
    'sha256'
  ), 'hex'),
  artifact.created_at
FROM prompt_artifacts AS artifact
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_revisions AS revision
  WHERE revision.prompt_artifact_id = artifact.id
);

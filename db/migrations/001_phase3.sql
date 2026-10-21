CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  auth_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT
  '{"assets":[],"prompts":[],"generationConfigurations":[]}'::jsonb;

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  generation_job_id uuid,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  mime_type text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  size bigint NOT NULL CHECK (size >= 0),
  checksum text,
  width integer,
  height integer,
  duration double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visual_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompt_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  goal text,
  analysis jsonb,
  editing_intent jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id text,
  provider_job_id text,
  status text NOT NULL CHECK (status IN ('PENDING', 'QUEUED', 'SUBMITTING', 'GENERATING', 'PROCESSING', 'COMPLETE', 'FAILED', 'CANCELLED')),
  configuration jsonb NOT NULL,
  result_asset jsonb,
  progress double precision CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  error text,
  idempotency_key text,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS generation_jobs_owner_created_idx ON generation_jobs (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON projects (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_owner_created_idx ON media_assets (owner_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_generation_job_id_fkey'
      AND conrelid = 'media_assets'::regclass
  ) THEN
    ALTER TABLE media_assets
      ADD CONSTRAINT media_assets_generation_job_id_fkey
      FOREIGN KEY (generation_job_id) REFERENCES generation_jobs(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS generation_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  generation_job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  configuration jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preset_favorites (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preset_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, preset_id)
);

CREATE TABLE IF NOT EXISTS preset_recents (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preset_id text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, preset_id)
);

CREATE TABLE IF NOT EXISTS provider_metadata (
  provider_id text PRIMARY KEY,
  capabilities jsonb NOT NULL,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  destination text NOT NULL CHECK (destination IN ('device', 'app_library', 'my_basket')),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

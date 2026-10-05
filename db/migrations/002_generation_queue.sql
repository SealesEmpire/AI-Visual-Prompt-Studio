ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 4);
ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS locked_by text;

CREATE INDEX IF NOT EXISTS generation_jobs_queue_idx
  ON generation_jobs (next_retry_at, created_at)
  WHERE status IN ('PENDING', 'QUEUED');

ALTER TABLE asset_delivery_jobs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5);
ALTER TABLE asset_delivery_jobs
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE asset_delivery_jobs
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE IF NOT EXISTS user_storage_connections (
  owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('s3_compatible', 'cloudflare_r2', 'digitalocean_spaces', 'backblaze_b2')),
  endpoint text NOT NULL,
  region text NOT NULL,
  bucket text NOT NULL,
  credentials_encrypted text NOT NULL,
  credential_iv text NOT NULL,
  credential_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

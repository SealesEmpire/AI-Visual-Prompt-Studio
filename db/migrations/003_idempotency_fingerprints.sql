ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS request_fingerprint text
  CHECK (request_fingerprint IS NULL OR request_fingerprint ~ '^[a-f0-9]{64}$');

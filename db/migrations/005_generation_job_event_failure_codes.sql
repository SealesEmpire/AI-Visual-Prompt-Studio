ALTER TABLE generation_job_events
  ADD COLUMN IF NOT EXISTS error_code text
  CHECK (error_code IS NULL OR error_code ~ '^[A-Z0-9_:-]{1,160}$');

CREATE OR REPLACE FUNCTION capture_generation_job_status_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  safe_error_code text;
BEGIN
  IF NEW.status = 'FAILED' AND NEW.error ~ '^[A-Z0-9_:-]{1,160}$' THEN
    safe_error_code := NEW.error;
  ELSE
    safe_error_code := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO generation_job_events (owner_id, generation_job_id, previous_status, status, error_code)
    VALUES (NEW.owner_id, NEW.id, NULL, NEW.status, safe_error_code);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO generation_job_events (owner_id, generation_job_id, previous_status, status, error_code)
    VALUES (NEW.owner_id, NEW.id, OLD.status, NEW.status, safe_error_code);
  END IF;
  RETURN NEW;
END;
$$;

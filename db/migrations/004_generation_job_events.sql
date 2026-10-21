CREATE TABLE IF NOT EXISTS generation_job_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation_job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  previous_status text CHECK (
    previous_status IS NULL OR previous_status IN (
      'PENDING', 'QUEUED', 'SUBMITTING', 'GENERATING', 'PROCESSING',
      'COMPLETE', 'FAILED', 'CANCELLED'
    )
  ),
  status text NOT NULL CHECK (
    status IN (
      'PENDING', 'QUEUED', 'SUBMITTING', 'GENERATING', 'PROCESSING',
      'COMPLETE', 'FAILED', 'CANCELLED'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_job_events_owner_job_idx
  ON generation_job_events (owner_id, generation_job_id, id);

INSERT INTO generation_job_events (
  owner_id, generation_job_id, previous_status, status, created_at
)
SELECT jobs.owner_id, jobs.id, NULL, jobs.status, jobs.created_at
FROM generation_jobs AS jobs
WHERE NOT EXISTS (
  SELECT 1
  FROM generation_job_events AS events
  WHERE events.generation_job_id = jobs.id
    AND events.previous_status IS NULL
);

CREATE OR REPLACE FUNCTION capture_generation_job_status_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO generation_job_events (owner_id, generation_job_id, previous_status, status)
    VALUES (NEW.owner_id, NEW.id, NULL, NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO generation_job_events (owner_id, generation_job_id, previous_status, status)
    VALUES (NEW.owner_id, NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generation_job_status_event_trigger ON generation_jobs;
CREATE TRIGGER generation_job_status_event_trigger
AFTER INSERT OR UPDATE ON generation_jobs
FOR EACH ROW
EXECUTE FUNCTION capture_generation_job_status_event();

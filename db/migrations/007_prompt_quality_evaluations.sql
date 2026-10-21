ALTER TABLE prompt_artifacts
  ADD COLUMN IF NOT EXISTS quality_evaluation jsonb
  CHECK (
    quality_evaluation IS NULL OR
    (jsonb_typeof(quality_evaluation) = 'object' AND quality_evaluation->>'rubricVersion' = '1.0')
  );

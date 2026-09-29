ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

UPDATE public.quiz_results
SET idempotency_key = id
WHERE idempotency_key IS NULL;

ALTER TABLE public.quiz_results
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_results_idempotency_key_unique
  ON public.quiz_results (idempotency_key);

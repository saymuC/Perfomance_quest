CREATE OR REPLACE FUNCTION public.normalize_student_name(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT translate(lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

CREATE TABLE IF NOT EXISTS public.student_profiles (
  id UUID PRIMARY KEY,
  device_id UUID,
  student_name TEXT NOT NULL CHECK (char_length(student_name) BETWEEN 1 AND 120),
  name_key TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL CHECK (char_length(class_name) BETWEEN 1 AND 40),
  registration_number TEXT NOT NULL CHECK (char_length(registration_number) BETWEEN 1 AND 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.student_profiles(id);

INSERT INTO public.student_profiles (id, student_name, name_key, class_name, registration_number)
SELECT DISTINCT ON (public.normalize_student_name(student_name))
  gen_random_uuid(), student_name, public.normalize_student_name(student_name), class_name, registration_number
FROM public.quiz_results
ORDER BY public.normalize_student_name(student_name), created_at
ON CONFLICT (name_key) DO NOTHING;

UPDATE public.quiz_results AS result
SET student_id = profile.id
FROM public.student_profiles AS profile
WHERE result.student_id IS NULL
  AND public.normalize_student_name(result.student_name) = profile.name_key;

ALTER TABLE public.quiz_results
  ALTER COLUMN student_id SET NOT NULL;

DROP INDEX IF EXISTS public.quiz_results_ranking_idx;
CREATE INDEX IF NOT EXISTS quiz_results_ranking_idx
  ON public.quiz_results (lower(class_name), percentage DESC, score DESC, total_time_seconds, created_at);

CREATE INDEX IF NOT EXISTS quiz_results_student_ranking_idx
  ON public.quiz_results (student_id, percentage DESC, score DESC, total_time_seconds, created_at);

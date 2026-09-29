CREATE OR REPLACE FUNCTION public.normalize_student_name(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT translate(lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

ALTER TABLE public.student_profiles
  ALTER COLUMN device_id DROP NOT NULL;

ALTER TABLE public.student_profiles
  DROP CONSTRAINT IF EXISTS student_profiles_device_id_key;

DO $$
DECLARE
  duplicate RECORD;
BEGIN
  FOR duplicate IN
    SELECT id, canonical_id, canonical_name_key
    FROM (
      SELECT id,
        first_value(id) OVER (PARTITION BY public.normalize_student_name(student_name) ORDER BY created_at, id) AS canonical_id,
        public.normalize_student_name(student_name) AS canonical_name_key,
        row_number() OVER (PARTITION BY public.normalize_student_name(student_name) ORDER BY created_at, id) AS position
      FROM public.student_profiles
    ) ranked
    WHERE position > 1
  LOOP
    UPDATE public.quiz_results SET student_id = duplicate.canonical_id WHERE student_id = duplicate.id;
    DELETE FROM public.student_profiles WHERE id = duplicate.id;
  END LOOP;
END $$;

UPDATE public.student_profiles
SET name_key = public.normalize_student_name(student_name);

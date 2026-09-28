CREATE TABLE IF NOT EXISTS public.quiz_results (
  id UUID PRIMARY KEY,
  student_name TEXT NOT NULL CHECK (char_length(student_name) BETWEEN 1 AND 120),
  class_name TEXT NOT NULL CHECK (char_length(class_name) BETWEEN 1 AND 40),
  registration_number TEXT NOT NULL CHECK (char_length(registration_number) BETWEEN 1 AND 40),
  score INTEGER NOT NULL CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions BETWEEN 1 AND 200 AND score <= total_questions),
  percentage INTEGER NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  total_time_seconds DOUBLE PRECISION NOT NULL CHECK (total_time_seconds BETWEEN 0 AND 86400),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) <= 200),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS quiz_results_ranking_idx
  ON public.quiz_results (lower(class_name), percentage DESC, score DESC, total_time_seconds, created_at);

DELETE FROM public.student_profiles AS profile
WHERE profile.name_key = 'aluno migrado'
  AND profile.registration_number LIKE 'legacy-%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.quiz_results AS result
    WHERE result.student_id = profile.id
  );

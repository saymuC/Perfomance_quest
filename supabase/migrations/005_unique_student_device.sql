CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_device_id_unique
  ON public.student_profiles (device_id)
  WHERE device_id IS NOT NULL;

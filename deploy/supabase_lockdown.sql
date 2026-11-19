-- Run ONCE in Supabase -> SQL Editor, after the backend has started and created its tables.
--
-- Supabase exposes every table in the "public" schema through a public web API whose key is not secret.
-- Chai Hut never uses that API (the FastAPI backend connects directly as the postgres role, which
-- ignores row-level security). Turning RLS on with no policies makes those tables unreadable through
-- the public API, so staff accounts and sales cannot be fetched by anyone holding the public key.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Check: every row should show rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- LOCAL REHEARSAL ONLY: never a production application login.
-- The restored app's GET authentication reconciler issues UPDATE statements even
-- when no rows match. Permit these statements, but reject every actual row change.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'chainsaw_recovery' OR
     inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet) THEN
    RAISE EXCEPTION 'Requires the isolated loopback chainsaw_recovery database';
  END IF;
END $$;
CREATE ROLE recovery_reader LOGIN;
GRANT USAGE ON SCHEMA public TO recovery_reader;
GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA public TO recovery_reader;
CREATE FUNCTION public.reject_recovery_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'recovery_reader' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'Read-only recovery row-change blocked';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('CREATE TRIGGER recovery_row_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_recovery_row_change()', t.tablename);
  END LOOP;
END $$;
COMMIT;

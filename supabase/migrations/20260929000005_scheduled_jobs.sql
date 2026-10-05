-- =============================================================================
-- Nightly housekeeping: close yesterday's meals, expire finished plans and clear
-- abandoned checkouts. Runs at 00:05 IST (18:35 UTC).
--
-- Uses pg_cron when the database has it (Supabase does). Elsewhere, call
-- `select public.close_past_meals();` once a day from any scheduler.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $cron$
      select cron.schedule('bhojan-close-past-meals', '35 18 * * *', 'select public.close_past_meals()')
    $cron$;
  else
    raise notice 'pg_cron is not available: schedule public.close_past_meals() daily yourself.';
  end if;
end;
$$;

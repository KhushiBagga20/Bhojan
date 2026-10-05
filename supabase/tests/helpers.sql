-- Test helpers: impersonate users the way PostgREST does, pin the clock, and
-- assert on results / error codes.
create schema if not exists tests;
grant usage on schema tests to public;

-- Act as a signed-in user (role "authenticated" with that user's JWT subject).
create or replace function tests.act_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.act_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.act_as_superuser()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function tests.set_now(p_local_time text)
returns void
language sql
as $$
  select set_config('bhojan.now', p_local_time, true);
$$;

create or replace function tests.assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end;
$$;

create or replace function tests.assert_eq(p_actual anyelement, p_expected anyelement, p_message text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ASSERTION FAILED: % (expected %, got %)', p_message, p_expected, p_actual;
  end if;
end;
$$;

-- Runs p_sql and asserts it fails with message p_code (an app error code) or
-- SQLSTATE p_code (e.g. 42501 insufficient_privilege).
create or replace function tests.assert_fails(p_sql text, p_code text, p_message text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code or sqlstate = p_code then
      return;
    end if;
    raise exception 'ASSERTION FAILED: % (expected error %, got % / %)', p_message, p_code, sqlstate, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % (expected error %, but it succeeded)', p_message, p_code;
end;
$$;

grant execute on all functions in schema tests to public;

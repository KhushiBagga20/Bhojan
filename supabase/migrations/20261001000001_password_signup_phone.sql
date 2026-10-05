-- =============================================================================
-- Email + password sign-in (used until an SMS provider is set up for phone OTP)
--
-- With password sign-up, auth.users.phone stays empty, so the apps send the
-- customer's mobile number as sign-up metadata ({ "phone": "+91..." }). Kitchens
-- need it to call customers about deliveries. Stored digits-only, like
-- auth.users.phone ("919810000001"). It is self-reported, not verified.
-- =============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, phone, email, name)
  values (
    new.id,
    coalesce(new.phone, nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '')),
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Don't wipe a sign-up phone number when only the email changes.
create or replace function public.handle_auth_user_contact_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set phone = coalesce(new.phone, phone), email = new.email
  where id = new.id;
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user(), public.handle_auth_user_contact_change()
  from public, anon, authenticated;

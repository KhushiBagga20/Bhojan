-- =============================================================================
-- Domain functions
--
-- All state changes to subscriptions, meals and payments go through these
-- SECURITY DEFINER functions, which check ownership themselves. Clients can read
-- those tables (through RLS) but cannot write them directly.
--
-- Errors are raised with a stable machine code as the message (e.g.
-- 'AREA_NOT_SERVED'); the apps translate codes into plain-language sentences.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Time. Everything is computed in the app timezone (IST).
-- `bhojan.now` lets SQL tests pin the clock. API clients cannot set it: PostgREST
-- only sets request.* settings and set_config() is not exposed.
-- ---------------------------------------------------------------------------
create or replace function public.app_now()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('bhojan.now', true), '')::timestamp,
    now() at time zone (select s.timezone from public.app_settings s where s.id)
  );
$$;

create or replace function public.app_today()
returns date
language sql
stable
set search_path = ''
as $$
  select public.app_now()::date;
$$;

-- The moment after which a customer can no longer skip / change a meal.
create or replace function public.meal_change_deadline(p_date date, p_window_start time, p_cutoff_hours integer)
returns timestamp
language sql
immutable
set search_path = ''
as $$
  select (p_date + coalesce(p_window_start, time '12:00')) - make_interval(hours => p_cutoff_hours);
$$;

-- ---------------------------------------------------------------------------
-- Access helpers (used by RLS policies). SECURITY DEFINER so policies do not
-- recurse into each other.
-- ---------------------------------------------------------------------------
create or replace function public.current_provider_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.provider_profiles p where p.user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'ADMIN');
$$;

-- Catalog data (profile, plans, menus, slots) is visible when the provider is
-- published, to the provider themselves, and to anyone who has ever subscribed
-- (so customers still see who cooks their food if a provider unpublishes).
create or replace function public.can_view_provider(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.provider_profiles p
    where p.id = p_provider_id
      and (
        p.is_published
        or p.user_id = auth.uid()
        or exists (
          select 1 from public.subscriptions s
          where s.provider_id = p.id and s.customer_id = auth.uid()
        )
      )
  ) or public.is_admin();
$$;

create or replace function public.is_customer_of_current_provider(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.customer_id = p_customer_id
      and s.provider_id = public.current_provider_id()
      and s.activated_at is not null
  );
$$;

create or replace function public.is_address_visible_to_current_provider(p_address_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.delivery_address_id = p_address_id
      and s.provider_id = public.current_provider_id()
      and s.activated_at is not null
  ) or exists (
    select 1 from public.meal_orders m
    where m.delivery_address_id = p_address_id
      and m.provider_id = public.current_provider_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Only one default address per customer: making one default clears the others.
create or replace function public.addresses_keep_single_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
    set is_default = false
    where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row when (new.is_default)
  execute function public.addresses_keep_single_default();

-- Creating a provider profile makes the user a provider.
create or replace function public.provider_profiles_promote_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users set role = 'PROVIDER' where id = new.user_id and role = 'CUSTOMER';
  return new;
end;
$$;

create trigger provider_profiles_promote
  after insert on public.provider_profiles
  for each row execute function public.provider_profiles_promote_user();

-- A provider can only go live once customers could actually subscribe.
create or replace function public.provider_profiles_check_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    if cardinality(new.service_pincodes) = 0 then
      raise exception using message = 'PROFILE_NEEDS_AREAS', errcode = 'P0001';
    end if;
    if not exists (select 1 from public.plans where provider_id = new.id and is_active) then
      raise exception using message = 'PROFILE_NEEDS_PLAN', errcode = 'P0001';
    end if;
    if not exists (select 1 from public.delivery_slots where provider_id = new.id and is_active) then
      raise exception using message = 'PROFILE_NEEDS_DELIVERY_TIME', errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger provider_profiles_publishable
  before insert or update of is_published on public.provider_profiles
  for each row execute function public.provider_profiles_check_publishable();

-- ---------------------------------------------------------------------------
-- Meal engine (internal: not callable by API clients)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_subscription_end_date(p_subscription_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscriptions s
  set end_date = coalesce(
    (select max(m.scheduled_date) from public.meal_orders m
     where m.subscription_id = s.id and m.status not in ('SKIPPED', 'CANCELLED')),
    s.end_date
  )
  where s.id = p_subscription_id;
$$;

-- Adds meals until the subscription has `meals_total` live (not skipped or
-- cancelled) meals. New meals go on the plan's delivery days, after the last
-- live meal and no earlier than p_from. Returns how many meals were created.
create or replace function public.top_up_meals(p_subscription_id uuid, p_from date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_live integer;
  v_last date;
  v_day date;
  v_created integer := 0;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception using message = 'SUBSCRIPTION_NOT_FOUND', errcode = 'P0001';
  end if;

  select count(*), max(m.scheduled_date) into v_live, v_last
  from public.meal_orders m
  where m.subscription_id = v_sub.id and m.status not in ('SKIPPED', 'CANCELLED');

  v_day := greatest(p_from, v_last + 1);

  -- The 400-day bound only protects against corrupt data (e.g. no delivery days).
  while v_created < v_sub.meals_total - v_live and v_day < p_from + 400 loop
    if extract(isodow from v_day)::smallint = any (v_sub.delivery_days)
       and not exists (
         select 1 from public.meal_orders m
         where m.subscription_id = v_sub.id and m.scheduled_date = v_day and m.meal_type = v_sub.meal_type
       ) then
      insert into public.meal_orders (
        subscription_id, customer_id, provider_id, delivery_address_id,
        scheduled_date, meal_type, window_start, window_end
      ) values (
        v_sub.id, v_sub.customer_id, v_sub.provider_id, v_sub.delivery_address_id,
        v_day, v_sub.meal_type, v_sub.window_start, v_sub.window_end
      );
      v_created := v_created + 1;
    end if;
    v_day := v_day + 1;
  end loop;

  perform public.refresh_subscription_end_date(v_sub.id);
  return v_created;
end;
$$;

-- ACTIVE <-> EXPIRED once every meal has been delivered (or undone by the provider).
create or replace function public.refresh_subscription_completion(p_subscription_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscriptions s
  set status = case
    when s.status = 'ACTIVE' and not exists (
      select 1 from public.meal_orders m
      where m.subscription_id = s.id and m.status in ('SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY')
    ) then 'EXPIRED'::public.subscription_status
    when s.status = 'EXPIRED' and exists (
      select 1 from public.meal_orders m
      where m.subscription_id = s.id and m.status in ('SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY')
    ) then 'ACTIVE'::public.subscription_status
    else s.status
  end
  where s.id = p_subscription_id;
$$;

-- Marks a payment as paid and turns its subscription on (generating meals).
-- Idempotent. Called by confirm_test_payment and by the Razorpay edge function.
create or replace function public.activate_paid_subscription(p_payment_id uuid, p_gateway_payment_id text)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_sub public.subscriptions%rowtype;
  v_start date;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception using message = 'PAYMENT_NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_sub from public.subscriptions where id = v_payment.subscription_id for update;

  if v_payment.status = 'PAID' then
    return v_sub;
  end if;
  if v_payment.status not in ('CREATED', 'FAILED') then
    raise exception using message = 'PAYMENT_NOT_PENDING', errcode = 'P0001';
  end if;

  update public.payments
  set status = 'PAID',
      gateway_payment_id = coalesce(p_gateway_payment_id, gateway_payment_id),
      failure_reason = null,
      paid_at = now()
  where id = v_payment.id;

  if v_sub.activated_at is not null then
    return v_sub;
  end if;

  -- If the chosen start date passed while the customer was paying, start today.
  v_start := greatest(v_sub.start_date, public.app_today());

  update public.subscriptions
  set status = 'ACTIVE', activated_at = now(), cancelled_at = null, start_date = v_start
  where id = v_sub.id;

  perform public.top_up_meals(v_sub.id, v_start);

  select * into v_sub from public.subscriptions where id = v_sub.id;
  return v_sub;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer: checkout
-- ---------------------------------------------------------------------------

-- Creates a subscription awaiting payment plus the payment to complete. Price,
-- meals and schedule always come from the plan on the server, never the client.
create or replace function public.create_subscription(
  p_plan_id uuid,
  p_address_id uuid,
  p_start_date date,
  p_slot_id uuid default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_provider public.provider_profiles%rowtype;
  v_address public.addresses%rowtype;
  v_slot public.delivery_slots%rowtype;
  v_sub public.subscriptions%rowtype;
  v_payment public.payments%rowtype;
begin
  if v_uid is null then
    raise exception using message = 'NOT_SIGNED_IN', errcode = 'P0001';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then
    raise exception using message = 'PLAN_UNAVAILABLE', errcode = 'P0001';
  end if;

  select * into v_provider from public.provider_profiles where id = v_plan.provider_id and is_published;
  if not found then
    raise exception using message = 'PLAN_UNAVAILABLE', errcode = 'P0001';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_uid;
  if not found then
    raise exception using message = 'ADDRESS_NOT_FOUND', errcode = 'P0001';
  end if;

  if not (v_address.pincode = any (v_provider.service_pincodes)) then
    raise exception using message = 'AREA_NOT_SERVED', errcode = 'P0001';
  end if;

  if p_start_date is null or p_start_date < public.app_today() + v_plan.min_notice_days then
    raise exception using message = 'START_DATE_TOO_SOON', errcode = 'P0001';
  end if;
  if p_start_date > public.app_today() + 60 then
    raise exception using message = 'START_DATE_TOO_FAR', errcode = 'P0001';
  end if;
  if v_plan.plan_type = 'ONE_TIME'
     and not (extract(isodow from p_start_date)::smallint = any (v_plan.delivery_days)) then
    raise exception using message = 'NOT_A_DELIVERY_DAY', errcode = 'P0001';
  end if;

  if p_slot_id is not null then
    select * into v_slot from public.delivery_slots
    where id = p_slot_id and provider_id = v_provider.id and meal_type = v_plan.meal_type and is_active;
    if not found then
      raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001';
    end if;
  else
    select * into v_slot from public.delivery_slots
    where provider_id = v_provider.id and meal_type = v_plan.meal_type and is_active
    order by start_time
    limit 1;
  end if;

  -- An earlier checkout for the same plan that was never paid is abandoned.
  update public.payments p
  set status = 'FAILED', failure_reason = 'Checkout replaced by a newer attempt'
  from public.subscriptions s
  where p.subscription_id = s.id and p.status = 'CREATED'
    and s.customer_id = v_uid and s.plan_id = v_plan.id and s.status = 'PENDING_PAYMENT';
  update public.subscriptions
  set status = 'CANCELLED', cancelled_at = now()
  where customer_id = v_uid and plan_id = v_plan.id and status = 'PENDING_PAYMENT';

  insert into public.subscriptions (
    customer_id, provider_id, plan_id, delivery_address_id, delivery_slot_id, status,
    plan_name, plan_type, meal_type, delivery_days, meals_total, price_rupees,
    window_start, window_end, start_date
  ) values (
    v_uid, v_provider.id, v_plan.id, v_address.id, v_slot.id, 'PENDING_PAYMENT',
    v_plan.name, v_plan.plan_type, v_plan.meal_type, v_plan.delivery_days, v_plan.meals_count, v_plan.price_rupees,
    v_slot.start_time, v_slot.end_time, p_start_date
  )
  returning * into v_sub;

  insert into public.payments (user_id, subscription_id, amount_paise, gateway)
  values (v_uid, v_sub.id, v_plan.price_rupees * 100, (select s.payment_mode from public.app_settings s where s.id))
  returning * into v_payment;

  return v_payment;
end;
$$;

-- Test checkout (only while app_settings.payment_mode = 'TEST'). p_succeed = false
-- simulates a declined payment so the failure path can be exercised.
create or replace function public.confirm_test_payment(p_payment_id uuid, p_succeed boolean default true)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_sub public.subscriptions%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id and user_id = auth.uid();
  if not found then
    raise exception using message = 'PAYMENT_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_payment.gateway <> 'TEST' or (select s.payment_mode from public.app_settings s where s.id) <> 'TEST' then
    raise exception using message = 'TEST_PAYMENTS_DISABLED', errcode = 'P0001';
  end if;

  if not p_succeed then
    update public.payments
    set status = 'FAILED', failure_reason = 'Test payment declined'
    where id = v_payment.id and status = 'CREATED';
    select * into v_sub from public.subscriptions where id = v_payment.subscription_id;
    return v_sub;
  end if;

  return public.activate_paid_subscription(v_payment.id, 'test_' || replace(gen_random_uuid()::text, '-', ''));
end;
$$;

-- Lets the app record that the gateway reported a failure, so the payment is
-- never left in an ambiguous state.
create or replace function public.record_payment_failure(p_payment_id uuid, p_reason text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  update public.payments
  set status = 'FAILED', failure_reason = left(coalesce(p_reason, 'Payment was not completed'), 200)
  where id = p_payment_id and user_id = auth.uid() and status = 'CREATED'
  returning * into v_payment;

  if not found then
    select * into v_payment from public.payments where id = p_payment_id and user_id = auth.uid();
    if not found then
      raise exception using message = 'PAYMENT_NOT_FOUND', errcode = 'P0001';
    end if;
  end if;
  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer: managing meals and plans
-- ---------------------------------------------------------------------------
create or replace function public.skip_meal(p_meal_id uuid)
returns public.meal_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meal public.meal_orders%rowtype;
  v_sub public.subscriptions%rowtype;
  v_cutoff smallint;
begin
  select * into v_meal from public.meal_orders where id = p_meal_id and customer_id = auth.uid() for update;
  if not found then
    raise exception using message = 'MEAL_NOT_FOUND', errcode = 'P0001';
  end if;
  select * into v_sub from public.subscriptions where id = v_meal.subscription_id for update;

  if v_sub.plan_type = 'ONE_TIME' then
    raise exception using message = 'ONE_TIME_USE_CANCEL', errcode = 'P0001';
  end if;
  if v_sub.status <> 'ACTIVE' then
    raise exception using message = 'PLAN_NOT_ACTIVE', errcode = 'P0001';
  end if;
  if v_meal.status <> 'SCHEDULED' then
    raise exception using message = 'MEAL_ALREADY_STARTED', errcode = 'P0001';
  end if;

  select skip_cutoff_hours into v_cutoff from public.provider_profiles where id = v_meal.provider_id;
  if public.meal_change_deadline(v_meal.scheduled_date, v_meal.window_start, v_cutoff) <= public.app_now() then
    raise exception using message = 'TOO_LATE_TO_CHANGE', errcode = 'P0001';
  end if;

  update public.meal_orders
  set status = 'SKIPPED', status_updated_at = now()
  where id = v_meal.id
  returning * into v_meal;

  -- The customer paid for meals_total meals: add a replacement at the end.
  perform public.top_up_meals(v_sub.id, public.app_today() + 1);
  return v_meal;
end;
$$;

create or replace function public.unskip_meal(p_meal_id uuid)
returns public.meal_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meal public.meal_orders%rowtype;
  v_sub public.subscriptions%rowtype;
  v_cutoff smallint;
  v_extra uuid;
begin
  select * into v_meal from public.meal_orders where id = p_meal_id and customer_id = auth.uid() for update;
  if not found then
    raise exception using message = 'MEAL_NOT_FOUND', errcode = 'P0001';
  end if;
  select * into v_sub from public.subscriptions where id = v_meal.subscription_id for update;

  if v_sub.status <> 'ACTIVE' then
    raise exception using message = 'PLAN_NOT_ACTIVE', errcode = 'P0001';
  end if;
  if v_meal.status <> 'SKIPPED' then
    raise exception using message = 'MEAL_NOT_SKIPPED', errcode = 'P0001';
  end if;

  select skip_cutoff_hours into v_cutoff from public.provider_profiles where id = v_meal.provider_id;
  if public.meal_change_deadline(v_meal.scheduled_date, v_meal.window_start, v_cutoff) <= public.app_now() then
    raise exception using message = 'TOO_LATE_TO_CHANGE', errcode = 'P0001';
  end if;

  update public.meal_orders
  set status = 'SCHEDULED', status_updated_at = now()
  where id = v_meal.id
  returning * into v_meal;

  -- Remove the replacement meal that the skip added at the end of the plan.
  if (select count(*) from public.meal_orders
      where subscription_id = v_sub.id and status not in ('SKIPPED', 'CANCELLED')) > v_sub.meals_total then
    select id into v_extra from public.meal_orders
    where subscription_id = v_sub.id and status = 'SCHEDULED' and id <> v_meal.id
    order by scheduled_date desc
    limit 1;
    delete from public.meal_orders where id = v_extra;
  end if;

  perform public.refresh_subscription_end_date(v_sub.id);
  return v_meal;
end;
$$;

-- Pausing removes upcoming meals that can still be changed. Meals already past
-- the cutoff (e.g. being cooked today) still arrive. Remaining meals are kept
-- and rescheduled on resume. Skipped days stay skipped, so resuming never
-- brings back a meal the customer chose to skip.
create or replace function public.pause_subscription(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_cutoff smallint;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id and customer_id = auth.uid() for update;
  if not found then
    raise exception using message = 'SUBSCRIPTION_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_sub.plan_type = 'ONE_TIME' then
    raise exception using message = 'ONE_TIME_USE_CANCEL', errcode = 'P0001';
  end if;
  if v_sub.status <> 'ACTIVE' then
    raise exception using message = 'PLAN_NOT_ACTIVE', errcode = 'P0001';
  end if;

  select skip_cutoff_hours into v_cutoff from public.provider_profiles where id = v_sub.provider_id;

  delete from public.meal_orders m
  where m.subscription_id = v_sub.id
    and m.status = 'SCHEDULED'
    and public.meal_change_deadline(m.scheduled_date, m.window_start, v_cutoff) > public.app_now();

  update public.subscriptions
  set status = 'PAUSED', paused_at = now()
  where id = v_sub.id
  returning * into v_sub;

  perform public.refresh_subscription_end_date(v_sub.id);
  select * into v_sub from public.subscriptions where id = v_sub.id;
  return v_sub;
end;
$$;

create or replace function public.resume_subscription(p_subscription_id uuid, p_resume_date date default null)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_from date := coalesce(p_resume_date, public.app_today() + 1);
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id and customer_id = auth.uid() for update;
  if not found then
    raise exception using message = 'SUBSCRIPTION_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_sub.status <> 'PAUSED' then
    raise exception using message = 'PLAN_NOT_PAUSED', errcode = 'P0001';
  end if;
  if v_from <= public.app_today() or v_from > public.app_today() + 60 then
    raise exception using message = 'RESUME_DATE_INVALID', errcode = 'P0001';
  end if;

  update public.subscriptions
  set status = 'ACTIVE', paused_at = null
  where id = v_sub.id;

  perform public.top_up_meals(v_sub.id, v_from);
  perform public.refresh_subscription_completion(v_sub.id);

  select * into v_sub from public.subscriptions where id = v_sub.id;
  return v_sub;
end;
$$;

-- Cancelling stops every upcoming meal that can still be changed. Meals past the
-- cutoff still arrive (the provider has already started cooking).
create or replace function public.cancel_subscription(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_cutoff smallint;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id and customer_id = auth.uid() for update;
  if not found then
    raise exception using message = 'SUBSCRIPTION_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_sub.status not in ('ACTIVE', 'PAUSED') then
    raise exception using message = 'PLAN_NOT_ACTIVE', errcode = 'P0001';
  end if;

  select skip_cutoff_hours into v_cutoff from public.provider_profiles where id = v_sub.provider_id;

  update public.meal_orders m
  set status = 'CANCELLED', status_updated_at = now()
  where m.subscription_id = v_sub.id
    and m.status = 'SCHEDULED'
    and public.meal_change_deadline(m.scheduled_date, m.window_start, v_cutoff) > public.app_now();

  update public.subscriptions
  set status = 'CANCELLED', cancelled_at = now(), paused_at = null
  where id = v_sub.id;

  perform public.refresh_subscription_end_date(v_sub.id);
  select * into v_sub from public.subscriptions where id = v_sub.id;
  return v_sub;
end;
$$;

-- ---------------------------------------------------------------------------
-- Provider: meal status
-- ---------------------------------------------------------------------------

-- Bulk status update for the signed-in provider's meals. Skipped / cancelled
-- meals are left untouched (so "mark this slot as preparing" is safe).
-- Cooking statuses are only allowed for today or earlier. Cancelling a meal adds
-- a replacement at the end of the customer's plan.
create or replace function public.update_meal_status(p_meal_ids uuid[], p_status public.meal_status)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid := public.current_provider_id();
  v_count integer;
  v_sub_ids uuid[];
  v_sub_id uuid;
  v_sub public.subscriptions%rowtype;
begin
  if v_provider is null then
    raise exception using message = 'NOT_A_PROVIDER', errcode = 'P0001';
  end if;
  if p_status = 'SKIPPED' then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_meal_ids), 0) = 0 then
    return 0;
  end if;
  if exists (
    select 1 from unnest(p_meal_ids) as ids (id)
    where not exists (select 1 from public.meal_orders m where m.id = ids.id and m.provider_id = v_provider)
  ) then
    raise exception using message = 'MEAL_NOT_FOUND', errcode = 'P0001';
  end if;
  if p_status in ('PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED') and exists (
    select 1 from public.meal_orders m where m.id = any (p_meal_ids) and m.scheduled_date > public.app_today()
  ) then
    raise exception using message = 'MEAL_IS_IN_FUTURE', errcode = 'P0001';
  end if;

  with updated as (
    update public.meal_orders m
    set status = p_status, status_updated_at = now()
    where m.id = any (p_meal_ids)
      and m.provider_id = v_provider
      and m.status not in ('SKIPPED', 'CANCELLED')
      and m.status <> p_status
    returning m.subscription_id
  )
  select count(*), coalesce(array_agg(distinct subscription_id), '{}') into v_count, v_sub_ids from updated;

  foreach v_sub_id in array v_sub_ids loop
    select * into v_sub from public.subscriptions where id = v_sub_id for update;
    if p_status = 'CANCELLED' then
      if v_sub.plan_type = 'ONE_TIME' then
        update public.subscriptions set status = 'CANCELLED', cancelled_at = now()
        where id = v_sub.id and status in ('ACTIVE', 'PAUSED');
      elsif v_sub.status = 'ACTIVE' then
        perform public.top_up_meals(v_sub.id, public.app_today() + 1);
      end if;
    end if;
    perform public.refresh_subscription_end_date(v_sub.id);
    perform public.refresh_subscription_completion(v_sub.id);
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nightly housekeeping (scheduled with pg_cron when available)
-- ---------------------------------------------------------------------------
create or replace function public.close_past_meals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Meals from previous days that were never marked are assumed delivered.
  update public.meal_orders
  set status = 'DELIVERED', status_updated_at = now()
  where scheduled_date < public.app_today()
    and status in ('SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY');

  update public.subscriptions s
  set status = 'EXPIRED'
  where s.status = 'ACTIVE'
    and not exists (
      select 1 from public.meal_orders m
      where m.subscription_id = s.id and m.status in ('SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY')
    );

  -- Abandoned checkouts.
  update public.payments p
  set status = 'FAILED', failure_reason = 'Checkout was not completed'
  from public.subscriptions s
  where p.subscription_id = s.id and p.status = 'CREATED'
    and s.status = 'PENDING_PAYMENT' and s.created_at < now() - interval '2 days';
  update public.subscriptions
  set status = 'CANCELLED', cancelled_at = now()
  where status = 'PENDING_PAYMENT' and created_at < now() - interval '2 days';
end;
$$;

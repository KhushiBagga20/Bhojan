-- =============================================================================
-- Location-based discovery.
--
-- Customers are shown the kitchens within app_settings.delivery_radius_km of
-- where they are, instead of having to know and type a PIN code. The same rule
-- is enforced again by the server at checkout.
--
--  * A kitchen's exact location is kept in provider_locations, which only its
--    owner can read: a home kitchen is somebody's home. Everyone else only ever
--    learns an approximate distance, through kitchens_near().
--  * Someone who cannot or will not share their location chooses their area
--    from the areas kitchens say they deliver to (kitchen_areas()).
--  * PIN codes are no longer asked for or used. The old columns stay so that no
--    existing data is lost.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column delivery_radius_km numeric(4, 1) not null default 10
  constraint app_settings_radius_range check (delivery_radius_km between 1 and 50);
comment on column public.app_settings.delivery_radius_km is
  'Customers see, and can order from, kitchens within this distance of their location.';

-- ---------------------------------------------------------------------------
-- Addresses: the PIN code becomes optional, coordinates are checked
-- ---------------------------------------------------------------------------
alter table public.addresses alter column pincode drop not null;
alter table public.addresses
  add constraint addresses_coordinates_valid check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );
comment on column public.addresses.pincode is 'No longer asked for. Kept for addresses saved before location-based discovery.';
comment on column public.addresses.latitude is 'Where the address is, captured from the device with the customer''s permission.';
comment on column public.provider_profiles.service_pincodes is 'No longer used. Kitchens are found by distance (provider_locations) or by service_areas.';

-- ---------------------------------------------------------------------------
-- Kitchen locations
-- ---------------------------------------------------------------------------
create table public.provider_locations (
  provider_id uuid primary key references public.provider_profiles (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m integer,
  updated_at timestamptz not null default now(),
  constraint provider_locations_latitude_range check (latitude between -90 and 90),
  constraint provider_locations_longitude_range check (longitude between -180 and 180),
  constraint provider_locations_accuracy_range check (accuracy_m is null or accuracy_m between 0 and 100000)
);
comment on table public.provider_locations is
  'Exact location of each kitchen. Readable only by its owner; customers only learn an approximate distance.';
comment on column public.provider_locations.accuracy_m is 'How precise the device said the reading was, in metres.';
create trigger provider_locations_set_updated_at before update on public.provider_locations
  for each row execute function public.set_updated_at();

alter table public.provider_locations enable row level security;
revoke all on public.provider_locations from anon, authenticated;
-- Row level security (below) limits every one of these to the owner's own row.
-- Update covers the whole row because saving is an upsert, which also "sets"
-- provider_id; the policy's check stops it being pointed at another kitchen.
grant select, insert, update on public.provider_locations to authenticated;

create policy "Providers read their own kitchen location"
  on public.provider_locations for select to authenticated
  using (provider_id = (select public.current_provider_id()));
create policy "Providers set their own kitchen location"
  on public.provider_locations for insert to authenticated
  with check (provider_id = (select public.current_provider_id()));
create policy "Providers update their own kitchen location"
  on public.provider_locations for update to authenticated
  using (provider_id = (select public.current_provider_id()))
  with check (provider_id = (select public.current_provider_id()));

-- ---------------------------------------------------------------------------
-- Distance
-- ---------------------------------------------------------------------------
-- Great-circle distance in kilometres (haversine). Plain SQL, so no extension
-- is needed; more than precise enough for a radius of a few kilometres.
create or replace function public.distance_km(
  lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371.0088 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  )));
$$;

-- The one rule for "can this kitchen deliver here?", used by discovery, by the
-- checkout screen and by create_subscription. Internal: not callable by clients.
--   * with coordinates: the address must be within the delivery radius;
--   * without them: the kitchen must list the address's area as one it delivers to.
create or replace function public.delivery_status(
  p_provider_id uuid, p_latitude double precision, p_longitude double precision, p_locality text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_location public.provider_locations%rowtype;
  v_radius numeric;
begin
  if p_latitude is not null and p_longitude is not null then
    select * into v_location from public.provider_locations where provider_id = p_provider_id;
    if not found then
      return 'AREA_NOT_SERVED';
    end if;
    select s.delivery_radius_km into v_radius from public.app_settings s where s.id;
    if public.distance_km(p_latitude, p_longitude, v_location.latitude, v_location.longitude) <= v_radius then
      return 'OK';
    end if;
    return 'AREA_NOT_SERVED';
  end if;

  if exists (
    select 1 from public.provider_profiles p, unnest(p.service_areas) as area
    where p.id = p_provider_id and lower(btrim(area)) = lower(btrim(coalesce(p_locality, '')))
  ) then
    return 'OK';
  end if;
  return 'ADDRESS_NEEDS_LOCATION';
end;
$$;

-- ---------------------------------------------------------------------------
-- Discovery
-- ---------------------------------------------------------------------------
-- Published kitchens within the delivery radius of a point, nearest first. The
-- distance is rounded to half a kilometre so that a kitchen's exact position
-- cannot be read off it. The point itself is not stored anywhere.
create or replace function public.kitchens_near(p_latitude double precision, p_longitude double precision)
returns table (provider_id uuid, distance_km numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception using message = 'LOCATION_INVALID', errcode = 'P0001';
  end if;

  return query
  select p.id, (round(d.km * 2) / 2)::numeric(5, 1)
  from public.provider_profiles p
  join public.provider_locations l on l.provider_id = p.id
  cross join lateral (select public.distance_km(p_latitude, p_longitude, l.latitude, l.longitude) as km) d
  where p.is_published
    and d.km <= (select s.delivery_radius_km from public.app_settings s where s.id)
  order by round(d.km * 2), p.rating desc nulls last, p.business_name;
end;
$$;

-- For people who do not share their location: the areas that published kitchens
-- say they deliver to, and the kitchens for one of those areas.
create or replace function public.kitchen_areas()
returns table (area text, city text, kitchens bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select min(btrim(a.area)), min(p.city), count(distinct p.id)
  from public.provider_profiles p, unnest(p.service_areas) as a(area)
  where p.is_published and btrim(a.area) <> ''
  group by lower(btrim(a.area)), lower(btrim(p.city))
  order by 1;
$$;

create or replace function public.kitchens_in_area(p_area text)
returns table (provider_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.provider_profiles p
  where p.is_published
    and exists (select 1 from unnest(p.service_areas) as a(area) where lower(btrim(a.area)) = lower(btrim(p_area)))
  order by p.rating desc nulls last, p.business_name;
$$;

-- Lets the checkout screen say, before any payment, whether a kitchen delivers
-- to one of the customer's own addresses. Returns OK, AREA_NOT_SERVED or
-- ADDRESS_NEEDS_LOCATION.
create or replace function public.delivery_check(p_provider_id uuid, p_address_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_address public.addresses%rowtype;
begin
  select * into v_address from public.addresses where id = p_address_id and user_id = auth.uid();
  if not found then
    raise exception using message = 'ADDRESS_NOT_FOUND', errcode = 'P0001';
  end if;
  return public.delivery_status(p_provider_id, v_address.latitude, v_address.longitude, v_address.locality);
end;
$$;

revoke all on function public.distance_km(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.delivery_status(uuid, double precision, double precision, text) from public, anon, authenticated;
revoke all on function public.kitchens_near(double precision, double precision) from public;
revoke all on function public.kitchen_areas() from public;
revoke all on function public.kitchens_in_area(text) from public;
revoke all on function public.delivery_check(uuid, uuid) from public, anon;
grant execute on function public.kitchens_near(double precision, double precision) to anon, authenticated;
grant execute on function public.kitchen_areas() to anon, authenticated;
grant execute on function public.kitchens_in_area(text) to anon, authenticated;
grant execute on function public.delivery_check(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Going live needs a location instead of PIN codes
-- ---------------------------------------------------------------------------
create or replace function public.provider_profiles_check_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    if not exists (select 1 from public.provider_locations where provider_id = new.id) then
      raise exception using message = 'PROFILE_NEEDS_LOCATION', errcode = 'P0001';
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

-- Kitchens that went live before this change have no location yet, so customers
-- could not find them. They are taken offline until their owner sets one (one
-- tap in the dashboard) and goes live again. Nothing else about them changes.
update public.provider_profiles p
set is_published = false
where p.is_published
  and not exists (select 1 from public.provider_locations l where l.provider_id = p.id);

-- ---------------------------------------------------------------------------
-- Checkout: the delivery rule replaces the PIN code check
-- ---------------------------------------------------------------------------
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
  v_delivery text;
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

  v_delivery := public.delivery_status(v_provider.id, v_address.latitude, v_address.longitude, v_address.locality);
  if v_delivery <> 'OK' then
    raise exception using message = v_delivery, errcode = 'P0001';
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

-- =============================================================================
-- Bhojan core schema
--
-- Model in one sentence: a customer buys a plan from a provider, which creates a
-- subscription, which generates one meal_order per delivery day. Every meal is its
-- own row, so a customer can skip Tuesday and still receive Wednesday.
--
-- Money: plans are priced in whole rupees; payments are stored in paise (the unit
-- Razorpay uses). Dates are local calendar dates in the app timezone (IST).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('CUSTOMER', 'PROVIDER', 'ADMIN');
create type public.meal_type as enum ('BREAKFAST', 'LUNCH', 'DINNER');
create type public.plan_type as enum ('ONE_TIME', 'WEEKLY', 'MONTHLY');
create type public.diet_type as enum ('VEGETARIAN', 'NON_VEGETARIAN', 'BOTH');
create type public.subscription_status as enum ('PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');
create type public.meal_status as enum ('SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SKIPPED', 'CANCELLED');
create type public.payment_status as enum ('CREATED', 'PAID', 'FAILED', 'REFUNDED');
create type public.payment_gateway as enum ('TEST', 'RAZORPAY');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- App settings (single row, editable only by admins / service role)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  payment_mode public.payment_gateway not null default 'TEST',
  support_phone text,
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is 'Single-row global settings. payment_mode = TEST enables the no-money test checkout; set to RAZORPAY in production.';
insert into public.app_settings default values;

-- ---------------------------------------------------------------------------
-- users: one row per auth user (created by trigger on auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  phone text,
  email text,
  role public.user_role not null default 'CUSTOMER',
  dietary_preferences text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_name_length check (name is null or char_length(btrim(name)) between 1 and 80),
  constraint users_dietary_preferences_valid check (
    dietary_preferences <@ array['VEGETARIAN', 'JAIN', 'NO_ONION_GARLIC', 'LOW_SPICE', 'LESS_OIL', 'LESS_SALT']::text[]
  )
);
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

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
    new.phone,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_contact_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users set phone = new.phone, email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_contact_changed
  after update of phone, email on auth.users
  for each row execute function public.handle_auth_user_contact_change();

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null default 'Home',
  address_line text not null,
  locality text not null,
  city text not null,
  pincode text not null,
  instructions text,
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_label_length check (char_length(btrim(label)) between 1 and 30),
  constraint addresses_line_length check (char_length(btrim(address_line)) between 1 and 200),
  constraint addresses_locality_length check (char_length(btrim(locality)) between 1 and 100),
  constraint addresses_city_length check (char_length(btrim(city)) between 1 and 60),
  constraint addresses_pincode_format check (pincode ~ '^[1-9][0-9]{5}$'),
  constraint addresses_instructions_length check (instructions is null or char_length(instructions) <= 200)
);
comment on column public.addresses.address_line is 'House / flat number and building.';
comment on column public.addresses.instructions is 'Delivery note, e.g. "Ring the bell twice".';
create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;
create trigger addresses_set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- provider_profiles
-- ---------------------------------------------------------------------------
create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  business_name text not null,
  tagline text,
  description text,
  phone text not null,
  diet_type public.diet_type not null default 'VEGETARIAN',
  dietary_options text[] not null default '{}',
  city text not null,
  service_areas text[] not null default '{}',
  service_pincodes text[] not null default '{}',
  skip_cutoff_hours smallint not null default 3,
  cover_image_url text,
  rating numeric(2, 1),
  rating_count integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_business_name_length check (char_length(btrim(business_name)) between 2 and 80),
  constraint provider_tagline_length check (tagline is null or char_length(tagline) <= 120),
  constraint provider_description_length check (description is null or char_length(description) <= 1000),
  constraint provider_dietary_options_valid check (
    dietary_options <@ array['JAIN', 'NO_ONION_GARLIC', 'LOW_SPICE', 'LESS_OIL', 'LESS_SALT']::text[]
  ),
  constraint provider_pincodes_valid check (
    array_to_string(service_pincodes, ',') ~ '^([1-9][0-9]{5}(,[1-9][0-9]{5})*)?$'
  ),
  constraint provider_skip_cutoff_range check (skip_cutoff_hours between 0 and 48),
  constraint provider_rating_range check (rating is null or rating between 1 and 5)
);
comment on column public.provider_profiles.tagline is 'One line shown on the discovery card, e.g. "Home-style vegetarian meals".';
comment on column public.provider_profiles.skip_cutoff_hours is 'Customers can skip or change a meal until this many hours before its delivery window starts.';
comment on column public.provider_profiles.rating is 'Set by admins only (no review system in V1).';
create index provider_profiles_pincodes_idx on public.provider_profiles using gin (service_pincodes);
create trigger provider_profiles_set_updated_at before update on public.provider_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- delivery_slots: when a provider delivers each meal type
-- ---------------------------------------------------------------------------
create table public.delivery_slots (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  meal_type public.meal_type not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint delivery_slots_order check (end_time > start_time)
);
create index delivery_slots_provider_idx on public.delivery_slots (provider_id);

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  name text not null,
  description text,
  plan_type public.plan_type not null,
  meal_type public.meal_type not null,
  price_rupees integer not null,
  meals_count integer not null,
  delivery_days smallint[] not null,
  min_notice_days smallint not null default 1,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_name_length check (char_length(btrim(name)) between 2 and 60),
  constraint plans_description_length check (description is null or char_length(description) <= 300),
  constraint plans_price_range check (price_rupees between 1 and 100000),
  constraint plans_meals_count_range check (meals_count between 1 and 62),
  constraint plans_one_time_single_meal check (plan_type <> 'ONE_TIME' or meals_count = 1),
  constraint plans_delivery_days_valid check (
    cardinality(delivery_days) between 1 and 7 and delivery_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  constraint plans_min_notice_range check (min_notice_days between 0 and 14)
);
comment on column public.plans.delivery_days is 'ISO weekdays: 1 = Monday ... 7 = Sunday.';
comment on column public.plans.meals_count is 'Meals included in one purchase of this plan (26 for Mon-Sat monthly).';
comment on column public.plans.min_notice_days is 'Start rule: the earliest start date is today + this many days.';
create index plans_provider_idx on public.plans (provider_id);
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- menus + menu_items
-- A menu is either weekly-recurring (day_of_week) or for one specific date
-- (menu_date, overrides the weekly menu for that day).
-- ---------------------------------------------------------------------------
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  meal_type public.meal_type not null default 'LUNCH',
  day_of_week smallint,
  menu_date date,
  title text,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menus_day_or_date check ((day_of_week is null) <> (menu_date is null)),
  constraint menus_day_of_week_range check (day_of_week is null or day_of_week between 1 and 7),
  constraint menus_id_provider_unique unique (id, provider_id)
);
create unique index menus_weekly_unique on public.menus (provider_id, meal_type, day_of_week) where day_of_week is not null;
create unique index menus_dated_unique on public.menus (provider_id, meal_type, menu_date) where menu_date is not null;
create trigger menus_set_updated_at before update on public.menus
  for each row execute function public.set_updated_at();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null,
  provider_id uuid not null,
  name text not null,
  description text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint menu_items_menu_fk foreign key (menu_id, provider_id)
    references public.menus (id, provider_id) on delete cascade,
  constraint menu_items_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint menu_items_description_length check (description is null or char_length(description) <= 200)
);
create index menu_items_menu_idx on public.menu_items (menu_id);

-- Uploaded menu cards (image or PDF). Stored as-is; no OCR in V1.
create table public.menu_files (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer,
  created_at timestamptz not null default now(),
  constraint menu_files_mime_valid check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
);
create index menu_files_provider_idx on public.menu_files (provider_id);

-- ---------------------------------------------------------------------------
-- subscriptions
-- Plan details are copied at purchase time so later edits by the provider never
-- change what a customer already bought.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete restrict,
  plan_id uuid not null references public.plans (id) on delete restrict,
  delivery_address_id uuid not null references public.addresses (id) on delete restrict,
  delivery_slot_id uuid references public.delivery_slots (id) on delete set null,
  status public.subscription_status not null default 'PENDING_PAYMENT',
  plan_name text not null,
  plan_type public.plan_type not null,
  meal_type public.meal_type not null,
  delivery_days smallint[] not null,
  meals_total integer not null,
  price_rupees integer not null,
  window_start time,
  window_end time,
  start_date date not null,
  end_date date,
  activated_at timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_meals_total_positive check (meals_total > 0),
  constraint subscriptions_price_positive check (price_rupees > 0)
);
comment on column public.subscriptions.meals_total is 'Meals paid for. Skipped meals are replaced at the end, so this many meals are always delivered.';
comment on column public.subscriptions.activated_at is 'Set when payment succeeds. Null means the checkout was never completed.';
create index subscriptions_customer_idx on public.subscriptions (customer_id);
create index subscriptions_provider_idx on public.subscriptions (provider_id);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meal_orders: one row per meal to be delivered
-- ---------------------------------------------------------------------------
create table public.meal_orders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  customer_id uuid not null references public.users (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete restrict,
  delivery_address_id uuid not null references public.addresses (id) on delete restrict,
  scheduled_date date not null,
  meal_type public.meal_type not null,
  window_start time,
  window_end time,
  status public.meal_status not null default 'SCHEDULED',
  status_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint meal_orders_one_per_day unique (subscription_id, scheduled_date, meal_type)
);
create index meal_orders_provider_date_idx on public.meal_orders (provider_id, scheduled_date);
create index meal_orders_customer_date_idx on public.meal_orders (customer_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- payments (no card data is ever stored; the gateway holds it)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  amount_paise integer not null,
  currency text not null default 'INR',
  status public.payment_status not null default 'CREATED',
  gateway public.payment_gateway not null,
  gateway_order_id text,
  gateway_payment_id text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount_paise > 0)
);
create index payments_user_idx on public.payments (user_id);
create index payments_subscription_idx on public.payments (subscription_id);
create unique index payments_gateway_payment_unique on public.payments (gateway, gateway_payment_id)
  where gateway_payment_id is not null;
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security and privileges
--
-- Principles
--  * Customers see only their own profile, addresses, subscriptions, meals and
--    payments.
--  * Providers manage their own catalog (profile, slots, plans, menus) and can
--    see the paying customers, addresses, subscriptions and meals of their own
--    service, and nothing else.
--  * Subscriptions, meals and payments are never written directly by clients.
--    They change only through the functions in 20260929000002_domain_functions.
--  * Published catalog data is public (anon can browse before signing up).
-- =============================================================================

alter table public.app_settings enable row level security;
alter table public.users enable row level security;
alter table public.addresses enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.delivery_slots enable row level security;
alter table public.plans enable row level security;
alter table public.menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_files enable row level security;
alter table public.subscriptions enable row level security;
alter table public.meal_orders enable row level security;
alter table public.payments enable row level security;

-- ---------------------------------------------------------------------------
-- Table privileges (on top of RLS). Supabase grants everything to anon and
-- authenticated by default; narrow that down.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.app_settings to anon, authenticated;

grant select on public.users to authenticated;
grant update (name, dietary_preferences) on public.users to authenticated;

grant select, insert, update, delete on public.addresses to authenticated;

grant select on public.provider_profiles to anon, authenticated;
grant insert (
  user_id, business_name, tagline, description, phone, diet_type, dietary_options,
  city, service_areas, service_pincodes, skip_cutoff_hours, cover_image_url
) on public.provider_profiles to authenticated;
grant update (
  business_name, tagline, description, phone, diet_type, dietary_options,
  city, service_areas, service_pincodes, skip_cutoff_hours, cover_image_url, is_published
) on public.provider_profiles to authenticated;

grant select on public.delivery_slots, public.plans, public.menus, public.menu_items, public.menu_files
  to anon, authenticated;
grant insert, update, delete on public.delivery_slots, public.plans, public.menus, public.menu_items, public.menu_files
  to authenticated;

grant select on public.subscriptions, public.meal_orders, public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- app_settings
create policy "Anyone can read app settings"
  on public.app_settings for select
  to anon, authenticated
  using (true);

-- users
create policy "Users read themselves; providers read their customers"
  on public.users for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_customer_of_current_provider(id)
    or (select public.is_admin())
  );

create policy "Users update themselves"
  on public.users for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- addresses
create policy "Customers read own addresses; providers read delivery addresses"
  on public.addresses for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_address_visible_to_current_provider(id)
    or (select public.is_admin())
  );

create policy "Customers add own addresses"
  on public.addresses for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Customers edit own addresses"
  on public.addresses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Customers delete own addresses"
  on public.addresses for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- provider_profiles
-- The direct owner check keeps INSERT ... RETURNING working (the helper cannot
-- see a row inserted by the same statement).
create policy "Published providers are public"
  on public.provider_profiles for select
  to anon, authenticated
  using (user_id = (select auth.uid()) or public.can_view_provider(id));

create policy "Users create their own provider profile"
  on public.provider_profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Providers edit their own profile"
  on public.provider_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Catalog tables share the same shape: public read, owner write.
create policy "Catalog is public: delivery slots"
  on public.delivery_slots for select to anon, authenticated
  using (public.can_view_provider(provider_id));
create policy "Providers manage own delivery slots"
  on public.delivery_slots for all to authenticated
  using (provider_id = (select public.current_provider_id()))
  with check (provider_id = (select public.current_provider_id()));

create policy "Catalog is public: plans"
  on public.plans for select to anon, authenticated
  using (public.can_view_provider(provider_id));
create policy "Providers manage own plans"
  on public.plans for all to authenticated
  using (provider_id = (select public.current_provider_id()))
  with check (provider_id = (select public.current_provider_id()));

create policy "Catalog is public: menus"
  on public.menus for select to anon, authenticated
  using (public.can_view_provider(provider_id));
create policy "Providers manage own menus"
  on public.menus for all to authenticated
  using (provider_id = (select public.current_provider_id()))
  with check (provider_id = (select public.current_provider_id()));

create policy "Catalog is public: menu items"
  on public.menu_items for select to anon, authenticated
  using (public.can_view_provider(provider_id));
create policy "Providers manage own menu items"
  on public.menu_items for all to authenticated
  using (provider_id = (select public.current_provider_id()))
  with check (provider_id = (select public.current_provider_id()));

create policy "Catalog is public: menu files"
  on public.menu_files for select to anon, authenticated
  using (public.can_view_provider(provider_id));
create policy "Providers manage own menu files"
  on public.menu_files for all to authenticated
  using (provider_id = (select public.current_provider_id()))
  with check (provider_id = (select public.current_provider_id()));

-- subscriptions (read-only for clients)
create policy "Customers and their provider read subscriptions"
  on public.subscriptions for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or (provider_id = (select public.current_provider_id()) and activated_at is not null)
    or (select public.is_admin())
  );

-- meal_orders (read-only for clients)
create policy "Customers and their provider read meals"
  on public.meal_orders for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or provider_id = (select public.current_provider_id())
    or (select public.is_admin())
  );

-- payments (read-only for clients)
create policy "Customers read own payments"
  on public.payments for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies, so the querying role must be able to run them.
grant execute on function
  public.current_provider_id(),
  public.is_admin(),
  public.can_view_provider(uuid),
  public.is_customer_of_current_provider(uuid),
  public.is_address_visible_to_current_provider(uuid)
to anon, authenticated;

grant execute on function
  public.app_now(),
  public.app_today(),
  public.meal_change_deadline(date, time, integer)
to anon, authenticated;

-- Customer actions
grant execute on function
  public.create_subscription(uuid, uuid, date, uuid),
  public.confirm_test_payment(uuid, boolean),
  public.record_payment_failure(uuid, text),
  public.skip_meal(uuid),
  public.unskip_meal(uuid),
  public.pause_subscription(uuid),
  public.resume_subscription(uuid, date),
  public.cancel_subscription(uuid)
to authenticated;

-- Provider actions
grant execute on function public.update_meal_status(uuid[], public.meal_status) to authenticated;

-- Server-only (edge functions and scheduled jobs use the service role)
grant execute on all functions in schema public to service_role;

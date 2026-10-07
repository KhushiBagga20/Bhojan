-- =============================================================================
-- End-to-end database workflow: customer checkout, meal generation, skipping,
-- pausing, cancelling; provider onboarding and meal status updates; and the
-- security guarantees around all of it. Runs in one transaction and rolls back.
--
-- Clock: Tuesday 29 September 2026, 10:00 IST unless a step says otherwise.
-- =============================================================================
begin;

do $$ begin perform tests.set_now('2026-09-29 10:00'); end $$;

-- Fixed ids for test actors.
create temporary table ids (name text primary key, id uuid);
grant select on ids to public;
insert into ids values
  ('customer_a', '00000000-0000-4000-8000-0000000000a1'),
  ('customer_b', '00000000-0000-4000-8000-0000000000b1'),
  ('new_provider_user', '00000000-0000-4000-8000-0000000000c1'),
  ('sharma_user', '00000000-0000-4000-8000-000000000001'),
  ('maa_user', '00000000-0000-4000-8000-000000000002'),
  ('sharma', '10000000-0000-4000-8000-000000000001'),
  ('maa', '10000000-0000-4000-8000-000000000002'),
  ('sharma_monthly_lunch', '20000000-0000-4000-8000-000000000013'),
  ('sharma_single_lunch', '20000000-0000-4000-8000-000000000011'),
  ('maa_weekly_lunch', '20000000-0000-4000-8000-000000000022');

create or replace function pg_temp.id(p_name text) returns uuid language sql stable as $$
  select id from ids where name = p_name
$$;

-- ---------------------------------------------------------------------------
-- 1. Anonymous visitors can browse published kitchens only.
-- ---------------------------------------------------------------------------
do $$
begin
  perform tests.act_as_anon();
  perform tests.assert_eq(
    (select count(*) from public.provider_profiles), 4::bigint,
    'anon sees the 4 published kitchens (not the draft)');
  -- Discovery by distance: a point in Malviya Nagar, New Delhi.
  perform tests.assert_eq((select count(*) from public.kitchens_near(28.5339, 77.2110)), 4::bigint,
    'anon finds the 4 kitchens within 10 km');
  perform tests.assert_eq(
    (select provider_id from public.kitchens_near(28.5339, 77.2110) limit 1), '10000000-0000-4000-8000-000000000001'::uuid,
    'the nearest kitchen comes first');
  perform tests.assert((select bool_and(distance_km <= 10 and distance_km * 2 = round(distance_km * 2))
                        from public.kitchens_near(28.5339, 77.2110)),
    'distances are within the radius and rounded to half a kilometre');
  perform tests.assert_eq((select count(*) from public.kitchens_near(18.9440, 72.8230)), 0::bigint,
    'no kitchens are found from Mumbai');
  perform tests.assert_fails('select * from public.kitchens_near(123, 77)', 'LOCATION_INVALID',
    'impossible coordinates are refused');
  perform tests.assert_fails('select count(*) from public.provider_locations', '42501',
    'anon cannot read where kitchens are');
  -- Discovery by area, for people who do not share their location.
  perform tests.assert((select count(*) > 0 from public.kitchen_areas() where area = 'Malviya Nagar'),
    'areas kitchens deliver to are listed');
  perform tests.assert_eq((select count(*) from public.kitchens_in_area('  saket ')), 2::bigint,
    'kitchens are found by area, ignoring case and spaces');
  perform tests.assert_eq(
    (select count(*) from public.plans where provider_id = '10000000-0000-4000-8000-000000000005'), 0::bigint,
    'anon cannot see plans of an unpublished kitchen');
  perform tests.assert(
    (select count(*) from public.menu_items where provider_id = pg_temp.id('sharma')) > 20,
    'anon can read published menus');
  perform tests.assert_fails('select * from public.users', '42501', 'anon cannot read users');
  perform tests.assert_fails('select * from public.subscriptions', '42501', 'anon cannot read subscriptions');
  perform tests.assert_fails(
    format('select public.create_subscription(%L, %L, %L)', pg_temp.id('sharma_monthly_lunch'), gen_random_uuid(), '2026-09-30'),
    '42501', 'anon cannot check out');
  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Sign-up creates a profile row; customers edit only safe columns.
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, phone) values
  ((select pg_temp.id('customer_a')), 'authenticated', 'authenticated', '919999000001'),
  ((select pg_temp.id('customer_b')), 'authenticated', 'authenticated', '919999000002');

do $$
declare
  v_address uuid;
begin
  perform tests.assert_eq((select phone from public.users where id = pg_temp.id('customer_a')), '919999000001',
    'auth trigger created the users row with the phone number');

  perform tests.act_as(pg_temp.id('customer_a'));
  update public.users set name = 'Mrs. Sharma', dietary_preferences = array['VEGETARIAN', 'LOW_SPICE']
  where id = pg_temp.id('customer_a');
  perform tests.assert_eq((select name from public.users where id = pg_temp.id('customer_a')), 'Mrs. Sharma',
    'customer can set their name');
  perform tests.assert_fails(
    format('update public.users set role = %L where id = %L', 'ADMIN', pg_temp.id('customer_a')),
    '42501', 'customer cannot change their role');

  insert into public.addresses (user_id, label, address_line, locality, city, latitude, longitude, is_default, instructions)
  values (pg_temp.id('customer_a'), 'Home', 'B-42, Second Floor', 'Malviya Nagar', 'New Delhi', 28.5339, 77.2110, true, 'Ring the bell twice')
  returning id into v_address;
  perform tests.assert_eq((select count(*) from public.provider_locations), 0::bigint,
    'customers cannot read where kitchens are');
  perform tests.assert_fails(
    format('insert into public.addresses (user_id, address_line, locality, city) values (%L, %L, %L, %L)',
      pg_temp.id('customer_b'), 'x', 'y', 'z'),
    '42501', 'customer cannot create an address for someone else');
  perform tests.assert_fails(
    format('insert into public.addresses (user_id, address_line, locality, city, latitude, longitude) values (%L, %L, %L, %L, 123, 77)',
      pg_temp.id('customer_a'), 'x', 'y', 'z'),
    '23514', 'coordinates must be real');

  perform tests.act_as(pg_temp.id('customer_b'));
  insert into public.addresses (user_id, label, address_line, locality, city, latitude, longitude, is_default)
  values (pg_temp.id('customer_b'), 'Home', 'C-7', 'Kalkaji', 'New Delhi', 28.5494, 77.2588, true);
  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Checkout: failed payment leaves nothing active; retry succeeds and
--    generates exactly the meals paid for.
-- ---------------------------------------------------------------------------
do $$
declare
  v_address uuid := (select id from public.addresses where user_id = pg_temp.id('customer_a'));
  v_payment public.payments;
  v_sub public.subscriptions;
  v_first_sub uuid;
begin
  perform tests.act_as(pg_temp.id('customer_a'));

  perform tests.assert_fails(
    format('select public.create_subscription(%L, %L, %L)', pg_temp.id('sharma_monthly_lunch'), v_address, '2026-09-29'),
    'START_DATE_TOO_SOON', 'plan needs one day notice');

  v_payment := public.create_subscription(pg_temp.id('sharma_monthly_lunch'), v_address, '2026-09-30');
  perform tests.assert_eq(v_payment.amount_paise, 208000, 'amount comes from the plan (₹2,080)');
  perform tests.assert_eq(v_payment.gateway, 'TEST'::public.payment_gateway, 'test gateway in TEST mode');
  v_first_sub := v_payment.subscription_id;
  perform tests.assert_eq((select status from public.subscriptions where id = v_first_sub),
    'PENDING_PAYMENT'::public.subscription_status, 'subscription waits for payment');
  perform tests.assert_eq((select count(*) from public.meal_orders where subscription_id = v_first_sub), 0::bigint,
    'no meals before payment');

  v_sub := public.confirm_test_payment(v_payment.id, false);
  perform tests.assert_eq(v_sub.status, 'PENDING_PAYMENT'::public.subscription_status, 'declined payment does not activate');
  perform tests.assert_eq((select status from public.payments where id = v_payment.id), 'FAILED'::public.payment_status,
    'declined payment is recorded as FAILED');

  -- Retry
  v_payment := public.create_subscription(pg_temp.id('sharma_monthly_lunch'), v_address, '2026-09-30');
  perform tests.assert_eq((select status from public.subscriptions where id = v_first_sub),
    'CANCELLED'::public.subscription_status, 'abandoned checkout is closed on retry');

  perform tests.act_as(pg_temp.id('sharma_user'));
  perform tests.assert_eq((select count(*) from public.subscriptions where id = v_payment.subscription_id), 0::bigint,
    'provider does not see unpaid checkouts');

  perform tests.act_as(pg_temp.id('customer_a'));
  v_sub := public.confirm_test_payment(v_payment.id, true);
  perform tests.assert_eq(v_sub.status, 'ACTIVE'::public.subscription_status, 'paid subscription is active');
  perform tests.assert_eq((select count(*) from public.meal_orders where subscription_id = v_sub.id), 26::bigint,
    '26 meals generated');
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_sub.id and extract(isodow from scheduled_date) = 7),
    0::bigint, 'no meals on Sundays');
  perform tests.assert_eq((select min(scheduled_date) from public.meal_orders where subscription_id = v_sub.id),
    date '2026-09-30', 'first meal on the start date');
  perform tests.assert_eq(v_sub.end_date, date '2026-10-29', 'end date is the 26th delivery day');
  perform tests.assert_eq((select window_start from public.meal_orders where subscription_id = v_sub.id limit 1),
    time '12:00', 'earliest delivery slot used by default');
  perform tests.assert_eq((select status from public.payments where id = v_payment.id), 'PAID'::public.payment_status,
    'payment is PAID');

  -- Paying twice is harmless.
  perform public.confirm_test_payment(v_payment.id, true);
  perform tests.assert_eq((select count(*) from public.meal_orders where subscription_id = v_sub.id), 26::bigint,
    'confirming twice does not double the meals');

  perform tests.act_as_superuser();
end;
$$;

-- Customer B subscribes to a different kitchen.
do $$
declare
  v_payment public.payments;
begin
  perform tests.act_as(pg_temp.id('customer_b'));
  v_payment := public.create_subscription(
    pg_temp.id('maa_weekly_lunch'),
    (select id from public.addresses where user_id = pg_temp.id('customer_b')),
    '2026-10-01');
  perform public.confirm_test_payment(v_payment.id, true);
  perform tests.assert_eq((select count(*) from public.meal_orders where customer_id = pg_temp.id('customer_b')), 6::bigint,
    'weekly plan has 6 meals');
  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Customers are isolated from each other and cannot write directly.
-- ---------------------------------------------------------------------------
do $$
declare
  v_a_sub uuid := (select id from public.subscriptions where customer_id = pg_temp.id('customer_a') and status = 'ACTIVE');
  v_a_meal uuid := (select id from public.meal_orders where subscription_id = v_a_sub order by scheduled_date limit 1);
begin
  perform tests.act_as(pg_temp.id('customer_b'));
  perform tests.assert_eq((select count(*) from public.subscriptions where customer_id = pg_temp.id('customer_a')), 0::bigint,
    'B cannot see A''s subscriptions');
  perform tests.assert_eq((select count(*) from public.meal_orders where customer_id = pg_temp.id('customer_a')), 0::bigint,
    'B cannot see A''s meals');
  perform tests.assert_eq((select count(*) from public.users where id = pg_temp.id('customer_a')), 0::bigint,
    'B cannot see A''s profile');
  perform tests.assert_eq((select count(*) from public.addresses where user_id = pg_temp.id('customer_a')), 0::bigint,
    'B cannot see A''s address');
  perform tests.assert_eq((select count(*) from public.payments where user_id = pg_temp.id('customer_a')), 0::bigint,
    'B cannot see A''s payments');
  perform tests.assert_fails(format('select public.skip_meal(%L)', v_a_meal), 'MEAL_NOT_FOUND', 'B cannot skip A''s meal');
  perform tests.assert_fails(format('select public.cancel_subscription(%L)', v_a_sub), 'SUBSCRIPTION_NOT_FOUND',
    'B cannot cancel A''s plan');

  perform tests.act_as(pg_temp.id('customer_a'));
  perform tests.assert_fails(
    format('update public.subscriptions set status = %L where id = %L', 'ACTIVE', v_a_sub), '42501',
    'customers cannot write subscriptions directly');
  perform tests.assert_fails(
    format('update public.meal_orders set status = %L where id = %L', 'DELIVERED', v_a_meal), '42501',
    'customers cannot write meals directly');
  perform tests.assert_fails(
    format('update public.payments set status = %L where subscription_id = %L', 'PAID', v_a_sub), '42501',
    'customers cannot mark payments paid');
  perform tests.assert_fails(format('select public.top_up_meals(%L, %L)', v_a_sub, '2026-10-01'), '42501',
    'internal meal engine is not callable');
  perform tests.assert_fails(format('select public.activate_paid_subscription(%L, %L)', gen_random_uuid(), 'x'), '42501',
    'activation is server-only');
  perform tests.assert_fails(format('select public.update_meal_status(array[%L]::uuid[], %L)', v_a_meal, 'DELIVERED'),
    'NOT_A_PROVIDER', 'customers cannot update meal status');
  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Skip, undo, cutoff, pause and resume.
-- ---------------------------------------------------------------------------
do $$
declare
  v_sub uuid := (select id from public.subscriptions where customer_id = pg_temp.id('customer_a') and status = 'ACTIVE');
  v_first uuid := (select id from public.meal_orders where subscription_id = v_sub and scheduled_date = '2026-09-30');
  v_meal public.meal_orders;
begin
  perform tests.act_as(pg_temp.id('customer_a'));

  v_meal := public.skip_meal(v_first);
  perform tests.assert_eq(v_meal.status, 'SKIPPED'::public.meal_status, 'meal skipped');
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_sub and status not in ('SKIPPED', 'CANCELLED')),
    26::bigint, 'a replacement keeps 26 meals');
  perform tests.assert_eq((select end_date from public.subscriptions where id = v_sub), date '2026-10-30',
    'plan now ends one delivery day later');
  perform tests.assert_eq(
    (select status from public.meal_orders where subscription_id = v_sub and scheduled_date = '2026-10-01'),
    'SCHEDULED'::public.meal_status, 'the next day is unaffected');

  v_meal := public.unskip_meal(v_first);
  perform tests.assert_eq(v_meal.status, 'SCHEDULED'::public.meal_status, 'skip undone');
  perform tests.assert_eq((select count(*) from public.meal_orders where subscription_id = v_sub), 26::bigint,
    'replacement removed after undo');
  perform tests.assert_eq((select end_date from public.subscriptions where id = v_sub), date '2026-10-29',
    'end date restored');

  -- 12:00 window, 3 hour cutoff: changes close at 09:00 on the day.
  perform tests.set_now('2026-09-30 09:30');
  perform tests.assert_fails(format('select public.skip_meal(%L)', v_first), 'TOO_LATE_TO_CHANGE',
    'cannot skip after the cutoff');

  perform public.pause_subscription(v_sub);
  perform tests.assert_eq((select status from public.subscriptions where id = v_sub), 'PAUSED'::public.subscription_status,
    'plan paused');
  perform tests.assert_eq((select count(*) from public.meal_orders where subscription_id = v_sub), 1::bigint,
    'only the meal already past its cutoff remains');
  perform tests.assert_fails(format('select public.skip_meal(%L)', v_first), 'PLAN_NOT_ACTIVE',
    'cannot skip while paused');

  -- Resume the following Monday; meals restart on Tuesday.
  perform tests.set_now('2026-10-05 10:00');
  perform public.resume_subscription(v_sub);
  perform tests.assert_eq((select status from public.subscriptions where id = v_sub), 'ACTIVE'::public.subscription_status,
    'plan resumed');
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_sub and status not in ('SKIPPED', 'CANCELLED')),
    26::bigint, 'all 26 paid meals are still coming');
  perform tests.assert_eq(
    (select min(scheduled_date) from public.meal_orders where subscription_id = v_sub and scheduled_date > '2026-09-30'),
    date '2026-10-06', 'meals restart the day after resuming');
  perform tests.assert_eq((select end_date from public.subscriptions where id = v_sub), date '2026-11-03',
    'end date moved by the pause');

  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Provider sees their customers and updates meal statuses.
-- ---------------------------------------------------------------------------
do $$
declare
  v_sub uuid := (select id from public.subscriptions where customer_id = pg_temp.id('customer_a') and status = 'ACTIVE');
  v_today uuid;
  v_tomorrow uuid;
  v_updated integer;
begin
  perform tests.set_now('2026-10-06 11:00');
  select id into v_today from public.meal_orders where subscription_id = v_sub and scheduled_date = '2026-10-06';
  select id into v_tomorrow from public.meal_orders where subscription_id = v_sub and scheduled_date = '2026-10-07';

  perform tests.act_as(pg_temp.id('sharma_user'));
  perform tests.assert_eq((select count(*) from public.subscriptions where id = v_sub), 1::bigint,
    'provider sees the paid subscription');
  perform tests.assert_eq((select name from public.users where id = pg_temp.id('customer_a')), 'Mrs. Sharma',
    'provider sees their customer''s name');
  perform tests.assert_eq(
    (select dietary_preferences from public.users where id = pg_temp.id('customer_a')),
    array['VEGETARIAN', 'LOW_SPICE'], 'provider sees dietary preferences');
  perform tests.assert_eq(
    (select instructions from public.addresses where user_id = pg_temp.id('customer_a')),
    'Ring the bell twice', 'provider sees delivery instructions');
  perform tests.assert_eq((select count(*) from public.users where id = pg_temp.id('customer_b')), 0::bigint,
    'provider cannot see another kitchen''s customer');
  perform tests.assert_eq((select count(*) from public.meal_orders where provider_id = pg_temp.id('maa')), 0::bigint,
    'provider cannot see another kitchen''s meals');

  v_updated := public.update_meal_status(array[v_today], 'PREPARING');
  perform tests.assert_eq(v_updated, 1, 'one meal marked preparing');
  perform public.update_meal_status(array[v_today], 'OUT_FOR_DELIVERY');
  perform public.update_meal_status(array[v_today], 'DELIVERED');
  perform tests.assert_eq((select status from public.meal_orders where id = v_today), 'DELIVERED'::public.meal_status,
    'meal delivered');

  perform tests.assert_fails(format('select public.update_meal_status(array[%L]::uuid[], %L)', v_tomorrow, 'PREPARING'),
    'MEAL_IS_IN_FUTURE', 'cannot start cooking tomorrow''s meal');

  -- The kitchen is closed tomorrow: cancelling adds a replacement at the end.
  perform public.update_meal_status(array[v_tomorrow], 'CANCELLED');
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_sub and status not in ('SKIPPED', 'CANCELLED')),
    26::bigint, 'customer still gets 26 meals');
  perform tests.assert_eq((select end_date from public.subscriptions where id = v_sub), date '2026-11-04',
    'end date extended by the cancelled meal');

  perform tests.act_as(pg_temp.id('maa_user'));
  perform tests.assert_fails(format('select public.update_meal_status(array[%L]::uuid[], %L)', v_today, 'PREPARING'),
    'MEAL_NOT_FOUND', 'another kitchen cannot touch these meals');

  perform tests.act_as(pg_temp.id('customer_a'));
  perform tests.assert_eq((select status from public.meal_orders where id = v_today), 'DELIVERED'::public.meal_status,
    'customer sees the delivered status');
  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. A new provider onboards: profile, delivery time, plan, menu, publish.
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email) values
  ((select pg_temp.id('new_provider_user')), 'authenticated', 'authenticated', 'kitchen@example.com');

do $$
declare
  v_uid uuid := pg_temp.id('new_provider_user');
  v_provider uuid;
  v_menu uuid;
  v_plan uuid;
  v_payment public.payments;
  v_address uuid := (select id from public.addresses where user_id = pg_temp.id('customer_a'));
  v_moved bigint;
begin
  perform tests.set_now('2026-10-06 11:00');
  perform tests.act_as(v_uid);

  insert into public.provider_profiles (user_id, business_name, tagline, phone, city, service_areas)
  values (v_uid, 'Gupta Ji ki Rasoi', 'Home-style vegetarian meals', '919812345678', 'New Delhi',
          array['Malviya Nagar'])
  returning id into v_provider;
  perform tests.assert_eq(public.current_provider_id(), v_provider, 'current_provider_id resolves');
  perform tests.assert_eq((select role from public.users where id = v_uid), 'PROVIDER'::public.user_role,
    'user became a provider');

  perform tests.assert_fails(
    format('update public.provider_profiles set is_published = true where id = %L', v_provider),
    'PROFILE_NEEDS_LOCATION', 'cannot publish without a kitchen location');
  perform tests.assert_fails(
    format('insert into public.provider_locations (provider_id, latitude, longitude) values (%L, 28.5, 77.2)', pg_temp.id('sharma')),
    '42501', 'cannot set the location of another kitchen');
  with moved as (
    update public.provider_locations set latitude = 0 where provider_id = pg_temp.id('sharma') returning 1
  )
  select count(*) into v_moved from moved;
  perform tests.assert_eq(v_moved, 0::bigint, 'cannot move another kitchen');
  insert into public.provider_locations (provider_id, latitude, longitude, accuracy_m) values (v_provider, 28.5360, 77.2090, 15);
  perform tests.assert_eq((select count(*) from public.provider_locations), 1::bigint,
    'a provider reads only their own kitchen location');
  -- Saving again is an upsert, exactly as the dashboard sends it.
  insert into public.provider_locations (provider_id, latitude, longitude, accuracy_m)
  values (v_provider, 28.5361, 77.2091, 12)
  on conflict (provider_id) do update
    set provider_id = excluded.provider_id, latitude = excluded.latitude,
        longitude = excluded.longitude, accuracy_m = excluded.accuracy_m;
  perform tests.assert_eq((select accuracy_m from public.provider_locations where provider_id = v_provider), 12,
    'a provider can update their kitchen location');
  perform tests.assert_fails(
    format('update public.provider_locations set provider_id = %L where provider_id = %L', pg_temp.id('sharma'), v_provider),
    '42501', 'a location cannot be pointed at another kitchen');
  perform tests.assert_fails(
    format('update public.provider_profiles set is_published = true where id = %L', v_provider),
    'PROFILE_NEEDS_PLAN', 'cannot publish without a plan');
  perform tests.assert_fails(
    format('update public.provider_profiles set rating = 5 where id = %L', v_provider),
    '42501', 'providers cannot set their own rating');
  perform tests.assert_fails(
    format('insert into public.plans (provider_id, name, plan_type, meal_type, price_rupees, meals_count, delivery_days) values (%L, %L, %L, %L, 1, 1, %L)',
      pg_temp.id('sharma'), 'Sneaky', 'ONE_TIME', 'LUNCH', '{1}'),
    '42501', 'cannot add plans to another kitchen');

  insert into public.plans (provider_id, name, plan_type, meal_type, price_rupees, meals_count, delivery_days)
  values (v_provider, 'Monthly lunch', 'MONTHLY', 'LUNCH', 1950, 26, '{1,2,3,4,5,6}')
  returning id into v_plan;
  perform tests.assert_fails(
    format('update public.provider_profiles set is_published = true where id = %L', v_provider),
    'PROFILE_NEEDS_DELIVERY_TIME', 'cannot publish without a delivery time');
  insert into public.delivery_slots (provider_id, meal_type, start_time, end_time)
  values (v_provider, 'LUNCH', '13:00', '13:30');

  insert into public.menus (provider_id, meal_type, day_of_week) values (v_provider, 'LUNCH', 1) returning id into v_menu;
  insert into public.menu_items (menu_id, provider_id, name, sort_order) values
    (v_menu, v_provider, 'Dal', 1), (v_menu, v_provider, 'Roti', 2), (v_menu, v_provider, 'Aloo gobhi', 3);
  perform tests.assert_fails(
    format('insert into public.menu_items (menu_id, provider_id, name) values (%L, %L, %L)',
      (select id from public.menus where provider_id = pg_temp.id('sharma') limit 1), v_provider, 'Sneaky'),
    '23503', 'cannot attach items to another kitchen''s menu');

  update public.provider_profiles set is_published = true where id = v_provider;

  -- Storage: own folder only.
  insert into storage.objects (bucket_id, name) values ('provider-media', v_provider || '/menu/card.pdf');
  perform tests.assert_fails(
    format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'provider-media', pg_temp.id('sharma') || '/menu/x.pdf'),
    '42501', 'cannot upload into another kitchen''s folder');

  -- The new kitchen is visible to customers and receives a subscription.
  perform tests.act_as(pg_temp.id('customer_a'));
  perform tests.assert_eq((select count(*) from public.menu_items where provider_id = v_provider), 3::bigint,
    'customer sees the new menu');
  v_payment := public.create_subscription(v_plan, v_address, '2026-10-07');
  perform public.confirm_test_payment(v_payment.id, true);

  perform tests.act_as(v_uid);
  perform tests.assert_eq((select count(*) from public.subscriptions where provider_id = v_provider), 1::bigint,
    'new kitchen receives the subscription');
  perform tests.assert_eq((select count(*) from public.meal_orders where provider_id = v_provider), 26::bigint,
    'new kitchen sees the generated meals');
  perform tests.assert_eq((select window_start from public.meal_orders where provider_id = v_provider limit 1),
    time '13:00', 'meals use the kitchen''s delivery time');
  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. One-time orders, checkout validation and cancelling.
-- ---------------------------------------------------------------------------
do $$
declare
  v_address uuid := (select id from public.addresses where user_id = pg_temp.id('customer_a'));
  v_far uuid;
  v_payment public.payments;
  v_sub public.subscriptions;
  v_meal uuid;
begin
  perform tests.set_now('2026-10-06 11:00');
  perform tests.act_as(pg_temp.id('customer_a'));

  perform tests.assert_fails(
    format('select public.create_subscription(%L, %L, %L)', pg_temp.id('sharma_single_lunch'), v_address, '2026-10-11'),
    'NOT_A_DELIVERY_DAY', 'no one-time orders on a Sunday');

  v_payment := public.create_subscription(pg_temp.id('sharma_single_lunch'), v_address, '2026-10-10');
  perform tests.assert_eq(v_payment.amount_paise, 8000, 'single lunch costs ₹80');
  v_sub := public.confirm_test_payment(v_payment.id, true);
  perform tests.assert_eq(v_sub.end_date, date '2026-10-10', 'one-time order is a single meal on that date');
  select id into v_meal from public.meal_orders where subscription_id = v_sub.id;
  perform tests.assert_fails(format('select public.skip_meal(%L)', v_meal), 'ONE_TIME_USE_CANCEL',
    'one-time orders are cancelled, not skipped');
  v_sub := public.cancel_subscription(v_sub.id);
  perform tests.assert_eq(v_sub.status, 'CANCELLED'::public.subscription_status, 'order cancelled');
  perform tests.assert_eq((select status from public.meal_orders where id = v_meal), 'CANCELLED'::public.meal_status,
    'its meal is cancelled');

  insert into public.addresses (user_id, label, address_line, locality, city, latitude, longitude)
  values (pg_temp.id('customer_a'), 'Daughter''s home', '12 Marine Drive', 'Churchgate', 'Mumbai', 18.9440, 72.8230)
  returning id into v_far;
  perform tests.assert_fails(
    format('select public.create_subscription(%L, %L, %L)', pg_temp.id('sharma_monthly_lunch'), v_far, '2026-10-08'),
    'AREA_NOT_SERVED', 'kitchen does not deliver more than 10 km away');
  perform tests.assert_eq(public.delivery_check(pg_temp.id('sharma'), v_far), 'AREA_NOT_SERVED',
    'the checkout screen is told the address is too far');
  perform tests.assert_eq(public.delivery_check(pg_temp.id('sharma'), v_address), 'OK',
    'the checkout screen is told a nearby address is fine');
  -- Without coordinates, the kitchen must list the address''s area.
  update public.addresses set latitude = null, longitude = null, locality = 'saket' where id = v_far;
  perform tests.assert_eq(public.delivery_check(pg_temp.id('sharma'), v_far), 'OK',
    'an address with no coordinates is accepted in an area the kitchen delivers to');
  update public.addresses set locality = 'Churchgate' where id = v_far;
  perform tests.assert_eq(public.delivery_check(pg_temp.id('sharma'), v_far), 'ADDRESS_NEEDS_LOCATION',
    'otherwise the address needs a location');
  perform tests.assert_fails(
    format('select public.create_subscription(%L, %L, %L)', pg_temp.id('sharma_monthly_lunch'), v_far, '2026-10-08'),
    'ADDRESS_NEEDS_LOCATION', 'and cannot be ordered to until it has one');
  perform tests.assert_fails(
    format('select public.delivery_check(%L, %L)', pg_temp.id('sharma'),
      (select id from public.addresses where user_id = pg_temp.id('customer_b') limit 1)),
    'ADDRESS_NOT_FOUND', 'delivery cannot be checked against someone else''s address');
  perform tests.assert_fails(
    format('delete from public.addresses where id = %L', v_address),
    '23001', 'an address used by a plan cannot be deleted');

  perform tests.act_as_superuser();
end;
$$;

-- Test checkout is refused once real payments are switched on.
do $$
declare
  v_payment public.payments;
begin
  perform tests.act_as(pg_temp.id('customer_b'));
  v_payment := public.create_subscription(
    pg_temp.id('maa_weekly_lunch'),
    (select id from public.addresses where user_id = pg_temp.id('customer_b')),
    '2026-10-12');
  perform tests.act_as_superuser();
  update public.app_settings set payment_mode = 'RAZORPAY';
  perform tests.act_as(pg_temp.id('customer_b'));
  perform tests.assert_fails(format('select public.confirm_test_payment(%L)', v_payment.id), 'TEST_PAYMENTS_DISABLED',
    'test payments disabled in production mode');
  perform tests.act_as_superuser();
  update public.app_settings set payment_mode = 'TEST';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Customer cancels a plan; nightly job closes past meals and expires plans.
-- ---------------------------------------------------------------------------
do $$
declare
  v_sub uuid := (select id from public.subscriptions
                 where customer_id = pg_temp.id('customer_a') and provider_id = pg_temp.id('sharma')
                   and plan_type = 'MONTHLY' and status = 'ACTIVE');
  v_new_kitchen_sub uuid := (select s.id from public.subscriptions s
                             join public.provider_profiles p on p.id = s.provider_id
                             where s.customer_id = pg_temp.id('customer_a') and p.business_name = 'Gupta Ji ki Rasoi');
begin
  -- 10:00 on Wed 7 Oct: the 12:00 meal is past its 09:00 cutoff and still comes.
  perform tests.set_now('2026-10-07 10:00');
  perform tests.act_as(pg_temp.id('customer_a'));
  perform public.cancel_subscription(v_new_kitchen_sub);
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_new_kitchen_sub and status = 'SCHEDULED'),
    1::bigint, 'today''s meal (past cutoff) still arrives after cancelling');
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_new_kitchen_sub and status = 'CANCELLED'),
    25::bigint, 'the other meals are cancelled');
  perform tests.assert_fails(format('select public.pause_subscription(%L)', v_new_kitchen_sub), 'PLAN_NOT_ACTIVE',
    'a cancelled plan cannot be paused');

  perform tests.act_as_superuser();
  perform tests.set_now('2026-12-01 00:10');
  perform public.close_past_meals();
  perform tests.assert_eq((select status from public.subscriptions where id = v_sub), 'EXPIRED'::public.subscription_status,
    'finished plan expires');
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_sub and status in ('SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY')),
    0::bigint, 'past meals are closed');
  perform tests.assert(
    exists (select 1 from public.subscriptions
            where customer_id = pg_temp.id('customer_b') and status = 'PENDING_PAYMENT'),
    'recent unpaid checkouts are left alone');
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. A skipped day stays skipped through pause and resume.
-- ---------------------------------------------------------------------------
do $$
declare
  v_payment public.payments;
  v_sub uuid;
  v_skip uuid;
begin
  -- Tuesday 1 December, 08:00. Maa's weekly lunch: 6 meals, Mon-Sat, 12:30 slot.
  perform tests.set_now('2026-12-01 08:00');
  perform tests.act_as(pg_temp.id('customer_a'));
  v_payment := public.create_subscription(
    pg_temp.id('maa_weekly_lunch'),
    (select id from public.addresses where user_id = pg_temp.id('customer_a') and label = 'Home'),
    '2026-12-02');
  perform public.confirm_test_payment(v_payment.id, true);
  v_sub := v_payment.subscription_id;
  select id into v_skip from public.meal_orders where subscription_id = v_sub and scheduled_date = '2026-12-04';
  perform public.skip_meal(v_skip);
  perform tests.assert_eq((select end_date from public.subscriptions where id = v_sub), date '2026-12-09',
    'skip moved the last meal to Wednesday 9 December');

  perform public.pause_subscription(v_sub);
  perform public.resume_subscription(v_sub);
  perform tests.assert_eq((select status from public.meal_orders where id = v_skip), 'SKIPPED'::public.meal_status,
    'the skipped day is still skipped after pause and resume');
  perform tests.assert_eq(
    (select count(*) from public.meal_orders where subscription_id = v_sub and status not in ('SKIPPED', 'CANCELLED')),
    6::bigint, 'still exactly the 6 paid meals');
  perform tests.assert_eq((select end_date from public.subscriptions where id = v_sub), date '2026-12-09',
    'meals flow around the skipped day');
  perform tests.act_as_superuser();
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Email + password sign-up keeps the mobile number from sign-up metadata.
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'asha@gmail.com',
   '{"phone": "+91 98765-43210"}');

do $$
begin
  perform tests.assert_eq((select phone from public.users where id = '00000000-0000-4000-8000-0000000000d1'),
    '919876543210', 'sign-up phone stored digits-only');
  update auth.users set email = 'asha.k@gmail.com' where id = '00000000-0000-4000-8000-0000000000d1';
  perform tests.assert_eq((select phone from public.users where id = '00000000-0000-4000-8000-0000000000d1'),
    '919876543210', 'changing the email keeps the phone');
  perform tests.assert_eq((select email from public.users where id = '00000000-0000-4000-8000-0000000000d1'),
    'asha.k@gmail.com', 'email change is synced');
end;
$$;

rollback;

\echo '  ✓ workflow: discovery by distance and area, checkout, meals, skip/undo, pause/resume (skips kept), cancel, provider onboarding, statuses, isolation, password sign-up phone'

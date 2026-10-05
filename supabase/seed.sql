-- =============================================================================
-- Demo data: four home kitchens in South Delhi (PIN 110017 is served by all of
-- them), plus one unpublished draft kitchen that customers must never see.
--
-- The kitchen owners are placeholder accounts. To try the provider dashboard,
-- sign in with your own phone/email and create a new provider profile.
-- =============================================================================

insert into auth.users (id, aud, role, phone, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '919810000001', '{"name": "Sunita Sharma"}'),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '919810000002', '{"name": "Kamla Devi"}'),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '919810000003', '{"name": "Rekha Jain"}'),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '919810000004', '{"name": "Harpreet Kaur"}'),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '919810000005', '{"name": "Draft Owner"}');

insert into public.provider_profiles
  (id, user_id, business_name, tagline, description, phone, diet_type, dietary_options,
   city, service_areas, service_pincodes, skip_cutoff_hours, rating, rating_count)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   'Sharma Home Tiffin', 'Home-style vegetarian meals',
   'Fresh North Indian food cooked every morning by Sunita Sharma in her Malviya Nagar kitchen. Less oil, no shortcuts: the way you would cook for your own family.',
   '919810000001', 'VEGETARIAN', array['LOW_SPICE', 'LESS_OIL'],
   'New Delhi', array['Malviya Nagar', 'Saket', 'Hauz Khas', 'Greater Kailash'], array['110017', '110016', '110048'],
   3, 4.7, 126),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002',
   'Maa''s Kitchen', 'Home-style vegetarian meals',
   'Simple dal-roti-sabzi meals, just like at home. Kamla ji has been feeding students and families in Kalkaji for twelve years.',
   '919810000002', 'VEGETARIAN', array['JAIN', 'NO_ONION_GARLIC'],
   'New Delhi', array['Malviya Nagar', 'Kalkaji', 'Lajpat Nagar', 'Defence Colony'], array['110017', '110019', '110024'],
   3, 4.5, 88),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003',
   'Annapurna Satvik Rasoi', 'Jain and satvik meals, no onion or garlic',
   'Light, satvik meals cooked without onion or garlic. Low salt on request. Popular with older customers who want gentle, nourishing food.',
   '919810000003', 'VEGETARIAN', array['JAIN', 'NO_ONION_GARLIC', 'LOW_SPICE', 'LESS_SALT'],
   'New Delhi', array['Malviya Nagar', 'Lajpat Nagar'], array['110017', '110024'],
   4, 4.8, 54),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004',
   'Punjabi Ghar ka Khana', 'Homestyle meals, egg and chicken twice a week',
   'Hearty Punjabi home cooking. Vegetarian most days, with egg curry on Wednesdays and chicken on Saturdays.',
   '919810000004', 'BOTH', array['LOW_SPICE'],
   'New Delhi', array['Saket', 'Hauz Khas', 'Malviya Nagar'], array['110016', '110048', '110017'],
   3, 4.4, 41),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005',
   'Draft Kitchen', 'Not published yet', null,
   '919810000005', 'VEGETARIAN', '{}',
   'New Delhi', array['Malviya Nagar'], array['110017'],
   3, null, 0);

insert into public.delivery_slots (provider_id, meal_type, start_time, end_time) values
  ('10000000-0000-4000-8000-000000000001', 'LUNCH', '12:00', '12:30'),
  ('10000000-0000-4000-8000-000000000001', 'LUNCH', '12:30', '13:00'),
  ('10000000-0000-4000-8000-000000000001', 'DINNER', '19:30', '20:00'),
  ('10000000-0000-4000-8000-000000000002', 'LUNCH', '12:30', '13:00'),
  ('10000000-0000-4000-8000-000000000002', 'LUNCH', '13:00', '13:30'),
  ('10000000-0000-4000-8000-000000000003', 'LUNCH', '12:00', '12:30'),
  ('10000000-0000-4000-8000-000000000004', 'LUNCH', '12:30', '13:00'),
  ('10000000-0000-4000-8000-000000000004', 'DINNER', '20:00', '20:30'),
  ('10000000-0000-4000-8000-000000000005', 'LUNCH', '12:00', '12:30');

insert into public.plans
  (id, provider_id, name, description, plan_type, meal_type, price_rupees, meals_count, delivery_days, min_notice_days, sort_order)
values
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'Single lunch',
   'Try one lunch before you subscribe.', 'ONE_TIME', 'LUNCH', 80, 1, '{1,2,3,4,5,6}', 1, 1),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 'Weekly lunch',
   'Six lunches, Monday to Saturday.', 'WEEKLY', 'LUNCH', 480, 6, '{1,2,3,4,5,6}', 1, 2),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 'Monthly lunch',
   'Twenty-six lunches, Monday to Saturday. Our most popular plan.', 'MONTHLY', 'LUNCH', 2080, 26, '{1,2,3,4,5,6}', 1, 3),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 'Monthly dinner',
   'A lighter dinner, Monday to Saturday.', 'MONTHLY', 'DINNER', 2340, 26, '{1,2,3,4,5,6}', 1, 4),

  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000002', 'Single lunch',
   null, 'ONE_TIME', 'LUNCH', 90, 1, '{1,2,3,4,5,6}', 1, 1),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000002', 'Weekly lunch',
   'Six lunches, Monday to Saturday.', 'WEEKLY', 'LUNCH', 540, 6, '{1,2,3,4,5,6}', 1, 2),
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000002', 'Monthly lunch',
   'Twenty-six lunches, Monday to Saturday.', 'MONTHLY', 'LUNCH', 2340, 26, '{1,2,3,4,5,6}', 1, 3),

  ('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000003', 'Single lunch',
   null, 'ONE_TIME', 'LUNCH', 100, 1, '{1,2,3,4,5}', 1, 1),
  ('20000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000003', 'Monthly lunch (weekdays)',
   'Twenty-two lunches, Monday to Friday.', 'MONTHLY', 'LUNCH', 2200, 22, '{1,2,3,4,5}', 2, 2),

  ('20000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000004', 'Single lunch',
   null, 'ONE_TIME', 'LUNCH', 110, 1, '{1,2,3,4,5,6,7}', 1, 1),
  ('20000000-0000-4000-8000-000000000042', '10000000-0000-4000-8000-000000000004', 'Weekly lunch',
   'Seven lunches, every day of the week.', 'WEEKLY', 'LUNCH', 735, 7, '{1,2,3,4,5,6,7}', 1, 2),
  ('20000000-0000-4000-8000-000000000043', '10000000-0000-4000-8000-000000000004', 'Monthly lunch',
   'Twenty-six lunches, Monday to Saturday.', 'MONTHLY', 'LUNCH', 2730, 26, '{1,2,3,4,5,6}', 1, 3);

-- Weekly menus ---------------------------------------------------------------
-- Helper for readable seeding: one call per day.
create function pg_temp.seed_menu(p_provider uuid, p_meal public.meal_type, p_day smallint, p_items text[])
returns void
language plpgsql
as $$
declare
  v_menu uuid;
  i integer;
begin
  insert into public.menus (provider_id, meal_type, day_of_week)
  values (p_provider, p_meal, p_day)
  returning id into v_menu;
  for i in 1 .. cardinality(p_items) loop
    insert into public.menu_items (menu_id, provider_id, name, sort_order)
    values (v_menu, p_provider, p_items[i], i);
  end loop;
end;
$$;

select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'LUNCH', 1::smallint, array['Arhar dal', 'Aloo gobhi', '4 phulka rotis', 'Jeera rice', 'Salad']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'LUNCH', 2::smallint, array['Rajma', 'Steamed rice', '4 phulka rotis', 'Boondi raita', 'Salad']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'LUNCH', 3::smallint, array['Kadhi pakora', 'Steamed rice', 'Lauki sabzi', '4 phulka rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'LUNCH', 4::smallint, array['Chana dal', 'Bhindi masala', '4 phulka rotis', 'Rice', 'Salad']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'LUNCH', 5::smallint, array['Chole', 'Jeera rice', '4 phulka rotis', 'Onion salad']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'LUNCH', 6::smallint, array['Dal makhani', 'Veg pulao', 'Mix raita', '3 rotis', 'Gulab jamun']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'DINNER', 1::smallint, array['Moong dal', 'Tori sabzi', '3 phulka rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'DINNER', 2::smallint, array['Palak paneer', '3 phulka rotis', 'Salad']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'DINNER', 3::smallint, array['Masoor dal', 'Aloo methi', '3 phulka rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'DINNER', 4::smallint, array['Moong dal khichdi', 'Curd', 'Papad']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'DINNER', 5::smallint, array['Mixed veg', 'Dal tadka', '3 phulka rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000001', 'DINNER', 6::smallint, array['Matar paneer', 'Jeera rice', '2 rotis']);

select pg_temp.seed_menu('10000000-0000-4000-8000-000000000002', 'LUNCH', 1::smallint, array['Dal tadka', 'Aloo matar', '4 rotis', 'Rice']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000002', 'LUNCH', 2::smallint, array['Kadhi', 'Rice', 'Aloo jeera', '4 rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000002', 'LUNCH', 3::smallint, array['Rajma', 'Rice', 'Cabbage sabzi', '4 rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000002', 'LUNCH', 4::smallint, array['Moong dal', 'Baingan bharta', '4 rotis', 'Rice']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000002', 'LUNCH', 5::smallint, array['Chole', 'Rice', 'Boondi raita', '4 rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000002', 'LUNCH', 6::smallint, array['Veg biryani', 'Raita', 'Salad', 'Kheer']);

select pg_temp.seed_menu('10000000-0000-4000-8000-000000000003', 'LUNCH', 1::smallint, array['Moong dal', 'Lauki chana', '4 phulkas', 'Rice']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000003', 'LUNCH', 2::smallint, array['Toor dal', 'Kaddu sabzi', '4 phulkas', 'Rice']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000003', 'LUNCH', 3::smallint, array['Gatte ki sabzi', 'Moong dal', '4 phulkas']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000003', 'LUNCH', 4::smallint, array['Kadhi', 'Rice', 'Tinda sabzi', '4 phulkas']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000003', 'LUNCH', 5::smallint, array['Dal dhokli', 'Kachumber salad', 'Chaas']);

select pg_temp.seed_menu('10000000-0000-4000-8000-000000000004', 'LUNCH', 1::smallint, array['Dal makhani', 'Aloo gobhi', '3 lachha parathas']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000004', 'LUNCH', 2::smallint, array['Rajma', 'Rice', '3 rotis', 'Salad']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000004', 'LUNCH', 3::smallint, array['Egg curry', 'Rice', '3 rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000004', 'LUNCH', 4::smallint, array['Sarson da saag', 'Makki di roti', 'Butter']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000004', 'LUNCH', 5::smallint, array['Kadhi pakora', 'Rice', 'Aloo sabzi', '3 rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000004', 'LUNCH', 6::smallint, array['Chicken curry', 'Jeera rice', '3 rotis']);
select pg_temp.seed_menu('10000000-0000-4000-8000-000000000004', 'LUNCH', 7::smallint, array['Chole bhature', 'Lassi']);

-- Publish (the publish check requires areas, an active plan and a delivery time).
update public.provider_profiles
set is_published = true
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
);

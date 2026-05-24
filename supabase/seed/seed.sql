-- =============================================================================
-- Local dev seed — runs after `supabase db reset`. Safe to re-run.
-- Creates four demo profiles (one per tier) and a handful of listings.
-- =============================================================================
do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
  carol uuid := '33333333-3333-3333-3333-333333333333';
  dave  uuid := '44444444-4444-4444-4444-444444444444';
begin
  -- Stub auth rows so RLS works; in real Supabase these come from auth.users
  insert into auth.users (id, email, raw_user_meta_data, created_at, instance_id, aud, role)
  values
    (alice, 'alice@example.com', '{"display_name":"Alice M."}'::jsonb, now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (bob,   'bob@example.com',   '{"display_name":"Bob R."}'::jsonb,   now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (carol, 'carol@example.com', '{"display_name":"Carol P."}'::jsonb, now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (dave,  'dave@example.com',  '{"display_name":"Dave K."}'::jsonb,  now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  on conflict (id) do nothing;
end $$;

-- Profile tiers (auto-created by trigger; we just upgrade them)
update public.profiles set trust_tier='gold',     trust_score=72, seller_rating=4.8 where id='11111111-1111-1111-1111-111111111111';
update public.profiles set trust_tier='silver',   trust_score=52, buyer_rating=4.6  where id='22222222-2222-2222-2222-222222222222';
update public.profiles set trust_tier='bronze',   trust_score=28                    where id='33333333-3333-3333-3333-333333333333';
update public.profiles set trust_tier='platinum', trust_score=86, seller_rating=4.95 where id='44444444-4444-4444-4444-444444444444';

-- Sample listings around Miami (25.77,-80.19)
insert into public.listings (
  id, seller_id, title, description, category, condition,
  ask_price, min_bid, buy_now_price,
  pickup_point, pickup_h3_r8, status
) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'West Elm leather sofa, like new',
   'Moving sale. 84" three-seat, full-grain leather, two scuffs on back side. Smoke-free home. Buyer arranges pickup.',
   'furniture', 'like_new', 450, 250, 600,
   ST_MakePoint(-80.19, 25.77)::geography, '882a100727fffff', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444',
   'Samsung 65" 4K TV (2022)',
   'Crystal UHD, all accessories included, original box. Lightly used in guest room.',
   'electronics', 'good', 280, 180, 350,
   ST_MakePoint(-80.21, 25.79)::geography, '882a100763fffff', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Whirlpool washer + dryer pair',
   'Both working perfectly. About 5 years old. Buyer must handle pickup; 2nd floor walk-up.',
   'appliance', 'good', 350, 200, null,
   ST_MakePoint(-80.18, 25.78)::geography, '882a100731fffff', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
   'DeWalt 20V combo kit (drill + impact)',
   'Two batteries, charger, hard case. Used on one renovation.',
   'tools', 'good', 145, 90, 175,
   ST_MakePoint(-80.20, 25.76)::geography, '882a100725fffff', 'active')
on conflict (id) do nothing;

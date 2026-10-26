-- =============================================================================
-- Per-category fee adjustments + extended feed filters (weight, conditions)
-- Source of truth mirrored from packages/shared/src/trust.ts
-- =============================================================================

-- -----------------------------------------------------------------------------
-- compute_effective_fee_bps: tier-base fee + per-category delta, floored at 250 bps
-- -----------------------------------------------------------------------------
create or replace function public.compute_effective_fee_bps(
  p_tier trust_tier,
  p_category listing_category
)
returns integer
language sql
immutable
as $$
  select greatest(
    250,
    case p_tier
      when 'platinum' then 500
      when 'gold'     then 600
      when 'silver'   then 700
      else 800
    end
    +
    case p_category
      when 'scrap'     then -200
      when 'parts'     then -100
      when 'household' then -100
      else 0
    end
  );
$$;

grant execute on function public.compute_effective_fee_bps(trust_tier, listing_category) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- accept_bid: use compute_effective_fee_bps so category discounts apply
-- (Only the fee block changes; rest of the function is unchanged.)
-- -----------------------------------------------------------------------------
create or replace function public.accept_bid(p_bid_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing  uuid;
  v_seller   uuid;
  v_buyer    uuid;
  v_amount   numeric;
  v_thread   uuid;
  v_tx       uuid;
  v_fee_bps  integer;
  v_tier     trust_tier;
  v_category listing_category;
begin
  select b.listing_id, l.seller_id, b.buyer_id, b.amount, l.category
    into v_listing, v_seller, v_buyer, v_amount, v_category
  from public.bids b
  join public.listings l on l.id = b.listing_id
  where b.id = p_bid_id and b.status = 'active' and l.status = 'active'
  for update;

  if v_seller is null then
    raise exception 'Bid not acceptable';
  end if;
  if v_seller <> auth.uid() then
    raise exception 'Only the seller may accept';
  end if;

  select trust_tier into v_tier from public.profiles where id = v_seller;
  v_fee_bps := public.compute_effective_fee_bps(coalesce(v_tier, 'new'::trust_tier), v_category);

  update public.bids set status='accepted', updated_at=now() where id = p_bid_id;
  update public.bids set status='rejected', updated_at=now()
   where listing_id = v_listing and status = 'active';
  update public.listings set status='pending_pickup', updated_at=now() where id = v_listing;

  select id into v_thread from public.threads
    where listing_id = v_listing and buyer_id = v_buyer;

  insert into public.transactions (
    listing_id, bid_id, thread_id, seller_id, buyer_id,
    gross_amount, platform_fee_bps, platform_fee_amount, payout_amount,
    state, meet_otp
  )
  values (
    v_listing, p_bid_id, v_thread, v_seller, v_buyer,
    v_amount, v_fee_bps,
    round(v_amount * v_fee_bps / 10000.0, 2),
    round(v_amount * (10000 - v_fee_bps) / 10000.0, 2),
    'pending',
    lpad((floor(random() * 1000000))::text, 6, '0')
  )
  returning id into v_tx;

  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- listings_feed v2: adds weight + condition filters and returns effective fee
-- Drops the old signature first because Postgres treats it as a different function.
-- -----------------------------------------------------------------------------
drop function if exists public.listings_feed(double precision, double precision, integer, listing_category, numeric, numeric, text, integer, integer);

create or replace function public.listings_feed(
  viewer_lat   double precision,
  viewer_lng   double precision,
  radius_mi    integer default 25,
  in_category  listing_category default null,
  max_price    numeric default null,
  min_price    numeric default null,
  q            text default null,
  limit_n      integer default 50,
  offset_n     integer default 0,
  in_conditions listing_condition[] default null,
  min_lbs      numeric default null,
  max_lbs      numeric default null,
  sort_by      text default 'newest'   -- 'newest' | 'nearest' | 'price_asc' | 'price_desc' | 'weight_desc'
)
returns table (
  id uuid,
  seller_id uuid,
  seller_name text,
  seller_tier trust_tier,
  seller_rating numeric,
  title text,
  category listing_category,
  condition listing_condition,
  ask_price numeric,
  min_bid numeric,
  buy_now_price numeric,
  weight_lbs numeric,
  thumbnail_key text,
  distance_mi numeric,
  pickup_h3_r8 text,
  bid_count integer,
  view_count integer,
  effective_fee_bps integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.seller_id,
    p.display_name as seller_name,
    p.trust_tier   as seller_tier,
    p.seller_rating,
    l.title,
    l.category,
    l.condition,
    l.ask_price,
    l.min_bid,
    l.buy_now_price,
    l.weight_lbs,
    (select r2_key from public.listing_media
       where listing_id = l.id order by display_order asc limit 1) as thumbnail_key,
    round((ST_Distance(
              l.pickup_point,
              ST_MakePoint(viewer_lng, viewer_lat)::geography
           ) / 1609.344)::numeric, 1) as distance_mi,
    l.pickup_h3_r8,
    l.bid_count,
    l.view_count,
    public.compute_effective_fee_bps(coalesce(p.trust_tier, 'new'::trust_tier), l.category) as effective_fee_bps,
    l.created_at
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.status = 'active'
    and ST_DWithin(
          l.pickup_point,
          ST_MakePoint(viewer_lng, viewer_lat)::geography,
          radius_mi * 1609.344
        )
    and (in_category is null or l.category = in_category)
    and (in_conditions is null or l.condition = any(in_conditions))
    and (max_price is null or coalesce(l.ask_price, l.buy_now_price, 0) <= max_price)
    and (min_price is null or coalesce(l.ask_price, l.buy_now_price, 0) >= min_price)
    and (min_lbs is null or l.weight_lbs >= min_lbs)
    and (max_lbs is null or (l.weight_lbs is not null and l.weight_lbs <= max_lbs))
    and (q is null or l.title ilike '%' || q || '%' or l.description ilike '%' || q || '%')
  order by
    case when sort_by = 'newest'     then l.created_at end desc nulls last,
    case when sort_by = 'nearest'    then ST_Distance(l.pickup_point, ST_MakePoint(viewer_lng, viewer_lat)::geography) end asc nulls last,
    case when sort_by = 'price_asc'  then coalesce(l.ask_price, l.buy_now_price, l.min_bid, 0) end asc nulls last,
    case when sort_by = 'price_desc' then coalesce(l.ask_price, l.buy_now_price, l.min_bid, 0) end desc nulls last,
    case when sort_by = 'weight_desc' then l.weight_lbs end desc nulls last,
    l.created_at desc
  limit limit_n offset offset_n;
$$;

grant execute on function public.listings_feed(
  double precision, double precision, integer, listing_category,
  numeric, numeric, text, integer, integer,
  listing_condition[], numeric, numeric, text
) to authenticated;

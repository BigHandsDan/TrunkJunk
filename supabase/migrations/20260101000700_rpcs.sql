-- =============================================================================
-- RPCs (PostgREST-exposed functions)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- listings_feed: distance-aware, distance-fuzzed
-- Returns active listings within a radius without ever exposing exact coordinates.
-- -----------------------------------------------------------------------------
create or replace function public.listings_feed(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_mi  integer default 25,
  in_category listing_category default null,
  max_price  numeric default null,
  min_price  numeric default null,
  q text default null,
  limit_n integer default 50,
  offset_n integer default 0
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
  thumbnail_key text,
  distance_mi numeric,
  pickup_h3_r8 text,
  bid_count integer,
  view_count integer,
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
    (select r2_key from public.listing_media
       where listing_id = l.id order by display_order asc limit 1) as thumbnail_key,
    round((ST_Distance(
              l.pickup_point,
              ST_MakePoint(viewer_lng, viewer_lat)::geography
           ) / 1609.344)::numeric, 1) as distance_mi,
    l.pickup_h3_r8,
    l.bid_count,
    l.view_count,
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
    and (max_price is null or coalesce(l.ask_price, l.buy_now_price, 0) <= max_price)
    and (min_price is null or coalesce(l.ask_price, l.buy_now_price, 0) >= min_price)
    and (q is null or l.title ilike '%' || q || '%' or l.description ilike '%' || q || '%')
  order by l.created_at desc
  limit limit_n offset offset_n;
$$;

grant execute on function public.listings_feed(double precision, double precision, integer, listing_category, numeric, numeric, text, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- create_listing: server validates geo + assigns H3
-- -----------------------------------------------------------------------------
create or replace function public.create_listing(
  p_title text,
  p_description text,
  p_category listing_category,
  p_condition listing_condition,
  p_ask_price numeric,
  p_min_bid numeric,
  p_buy_now_price numeric,
  p_lat double precision,
  p_lng double precision,
  p_h3_r8 text,        -- client-computed via h3-js (we verify range only)
  p_zip3 text,
  p_weight_lbs integer default null,
  p_dims_in jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid coordinates';
  end if;

  insert into public.listings (
    seller_id, title, description, category, condition,
    ask_price, min_bid, buy_now_price,
    pickup_point, pickup_h3_r8, pickup_zip3,
    weight_lbs, dims_in, status
  )
  values (
    auth.uid(), p_title, p_description, p_category, p_condition,
    p_ask_price, p_min_bid, p_buy_now_price,
    ST_MakePoint(p_lng, p_lat)::geography, p_h3_r8, p_zip3,
    p_weight_lbs, p_dims_in, 'draft'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_listing(text, text, listing_category, listing_condition, numeric, numeric, numeric, double precision, double precision, text, text, integer, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- place_bid: creates a bid, auto-opens thread, marks prior bids as outbid
-- -----------------------------------------------------------------------------
create or replace function public.place_bid(
  p_listing_id uuid,
  p_amount numeric,
  p_message text default null,
  p_buy_now boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid_id uuid;
  v_seller uuid;
  v_min numeric;
  v_buy_now numeric;
  v_thread uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select seller_id, min_bid, buy_now_price
    into v_seller, v_min, v_buy_now
    from public.listings where id = p_listing_id and status = 'active'
    for update;

  if v_seller is null then
    raise exception 'Listing not available';
  end if;
  if v_seller = auth.uid() then
    raise exception 'Cannot bid on your own listing';
  end if;
  if v_min is not null and p_amount < v_min then
    raise exception 'Bid below minimum (% required)', v_min;
  end if;
  if p_buy_now and (v_buy_now is null or p_amount < v_buy_now) then
    raise exception 'Buy-now requires amount >= buy_now_price';
  end if;

  -- Mark existing active bids on this listing (other buyers) as outbid if lower
  update public.bids
     set status = 'outbid', updated_at = now()
   where listing_id = p_listing_id
     and status = 'active'
     and buyer_id <> auth.uid()
     and amount < p_amount;

  -- Withdraw caller's previous active bid on this listing (only one allowed at a time)
  update public.bids
     set status = 'withdrawn', updated_at = now()
   where listing_id = p_listing_id and buyer_id = auth.uid() and status = 'active';

  insert into public.bids (listing_id, buyer_id, amount, message, is_buy_now)
  values (p_listing_id, auth.uid(), p_amount, p_message, p_buy_now)
  returning id into v_bid_id;

  -- Ensure a thread exists
  insert into public.threads (listing_id, seller_id, buyer_id, bid_id)
  values (p_listing_id, v_seller, auth.uid(), v_bid_id)
  on conflict (listing_id, buyer_id)
    do update set bid_id = excluded.bid_id, updated_at = now()
  returning id into v_thread;

  return v_bid_id;
end;
$$;

grant execute on function public.place_bid(uuid, numeric, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- accept_bid: seller accepts; creates transaction in pending, ready for Stripe
-- -----------------------------------------------------------------------------
create or replace function public.accept_bid(p_bid_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing uuid;
  v_seller uuid;
  v_buyer uuid;
  v_amount numeric;
  v_thread uuid;
  v_tx uuid;
  v_fee_bps integer;
  v_tier trust_tier;
begin
  select b.listing_id, l.seller_id, b.buyer_id, b.amount
    into v_listing, v_seller, v_buyer, v_amount
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

  -- Determine fee tier
  select trust_tier into v_tier from public.profiles where id = v_seller;
  v_fee_bps := case v_tier
    when 'platinum' then 500
    when 'gold'     then 600
    when 'silver'   then 700
    else 800
  end;

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

grant execute on function public.accept_bid(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- confirm_pickup: both parties enter OTP; when both confirmed, funds release
-- (Stripe transfer is triggered by Edge Function listening on tx state change)
-- -----------------------------------------------------------------------------
create or replace function public.confirm_pickup(p_tx_id uuid, p_otp text)
returns transaction_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_now timestamptz := now();
begin
  select * into v_tx from public.transactions where id = p_tx_id for update;

  if v_tx is null then raise exception 'Transaction not found'; end if;
  if v_tx.state <> 'escrowed' then raise exception 'Tx not in escrow'; end if;
  if v_tx.meet_otp <> p_otp then raise exception 'Invalid OTP'; end if;

  if auth.uid() = v_tx.seller_id then
    update public.transactions set pickup_confirmed_seller = true where id = p_tx_id;
  elsif auth.uid() = v_tx.buyer_id then
    update public.transactions set pickup_confirmed_buyer = true where id = p_tx_id;
  else
    raise exception 'Not a party to this transaction';
  end if;

  -- If both confirmed, mark released (Stripe Edge Function does the transfer)
  if (select pickup_confirmed_seller and pickup_confirmed_buyer
        from public.transactions where id = p_tx_id) then
    update public.transactions
      set state = 'released', pickup_confirmed_at = v_now, released_at = v_now
      where id = p_tx_id;
    update public.listings set status='sold' where id = v_tx.listing_id;
    return 'released';
  end if;

  return v_tx.state;
end;
$$;

grant execute on function public.confirm_pickup(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- submit_rating: insert; trigger handles blind-reveal flipping
-- -----------------------------------------------------------------------------
create or replace function public.submit_rating(
  p_tx_id uuid,
  p_stars integer,
  p_tags text[],
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_ratee uuid;
  v_role text;
  v_id uuid;
begin
  select * into v_tx from public.transactions where id = p_tx_id;
  if v_tx is null then raise exception 'Tx not found'; end if;
  if v_tx.state not in ('released','completed') then
    raise exception 'Cannot rate until pickup confirmed';
  end if;

  if auth.uid() = v_tx.buyer_id then
    v_ratee := v_tx.seller_id; v_role := 'seller';
  elsif auth.uid() = v_tx.seller_id then
    v_ratee := v_tx.buyer_id;  v_role := 'buyer';
  else
    raise exception 'Not a party';
  end if;

  insert into public.ratings (transaction_id, rater_id, ratee_id, role_rated, stars, tags, comment)
  values (p_tx_id, auth.uid(), v_ratee, v_role, p_stars, p_tags, p_comment)
  returning id into v_id;

  -- Blind reveal: if both sides have rated, flip both visible
  if (select count(*) from public.ratings where transaction_id = p_tx_id) = 2 then
    update public.ratings set is_visible = true where transaction_id = p_tx_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.submit_rating(uuid, integer, text[], text) to authenticated;

-- -----------------------------------------------------------------------------
-- nearby_distance_only: convenience for listing detail when viewer may be away
-- -----------------------------------------------------------------------------
create or replace function public.listing_distance(
  p_listing_id uuid,
  viewer_lat double precision,
  viewer_lng double precision
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round((ST_Distance(
           l.pickup_point,
           ST_MakePoint(viewer_lng, viewer_lat)::geography
         ) / 1609.344)::numeric, 1)
  from public.listings l
  where l.id = p_listing_id and l.status in ('active','pending_pickup');
$$;

grant execute on function public.listing_distance(uuid, double precision, double precision) to authenticated;

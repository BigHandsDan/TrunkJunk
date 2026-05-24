-- =============================================================================
-- Trust Score recomputation
-- Runs nightly via pg_cron AND callable on-demand from an Edge Function.
-- =============================================================================
create or replace function public.recalc_trust_score(p_profile uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg_stars         numeric;
  v_rating_count      integer;
  v_tag_net_score     numeric;
  v_tx_count          integer;
  v_verify_score      numeric;
  v_response_score    numeric := 0.5;
  v_cancel_rate       numeric;
  v_dispute_loss_rate numeric;
  v_score             integer;
  v_tier              trust_tier;
  v_median_resp       integer;
begin
  -- Average stars across visible ratings
  select coalesce(avg(stars), 0), count(*)
    into v_avg_stars, v_rating_count
    from public.ratings
   where ratee_id = p_profile and is_visible = true;

  -- Tag net score (positive minus negative, normalized 0..1)
  with tag_data as (
    select rt.polarity
      from public.ratings r
      join public.rating_tags rt on rt.tag = any(r.tags)
     where r.ratee_id = p_profile and r.is_visible = true
  )
  select coalesce(
    clamp(
      (
        (count(*) filter (where polarity = 1)::numeric
         - count(*) filter (where polarity = -1)::numeric)
        / nullif(count(*), 0)
      ) / 2.0 + 0.5,
      0, 1
    ),
    0.5
  ) into v_tag_net_score
  from tag_data;

  -- Transaction count (released)
  select count(*) into v_tx_count
    from public.transactions
   where (seller_id = p_profile or buyer_id = p_profile)
     and state = 'released';

  -- Verification completeness (0..1) — average of 3 flags
  select (
    coalesce(phone_verified::int, 0)
    + coalesce(email_verified::int, 0)
    + coalesce(id_verified::int, 0)
  )::numeric / 3.0
  into v_verify_score
  from public.profiles where id = p_profile;

  -- Median response time across messages this user authored in threads they're a party to
  select percentile_cont(0.5) within group (order by extract(epoch from (m.created_at - prev.last_at)))
    into v_median_resp
    from public.messages m
    join public.threads t on t.id = m.thread_id
    left join lateral (
      select max(m2.created_at) as last_at
        from public.messages m2
       where m2.thread_id = m.thread_id
         and m2.sender_id <> m.sender_id
         and m2.created_at < m.created_at
    ) prev on true
   where m.sender_id = p_profile
     and prev.last_at is not null
     and (t.seller_id = p_profile or t.buyer_id = p_profile);

  v_response_score := case
    when v_median_resp is null then 0.5
    when v_median_resp < 1800  then 1.0          -- < 30 min
    when v_median_resp < 7200  then 0.8          -- < 2h
    when v_median_resp < 21600 then 0.6          -- < 6h
    when v_median_resp < 86400 then 0.3          -- < 24h
    else 0.1
  end;

  -- Cancellation rate
  with c as (
    select
      count(*) filter (where state = 'cancelled')::numeric as cancelled,
      count(*)::numeric as total
    from public.transactions
    where seller_id = p_profile or buyer_id = p_profile
  )
  select coalesce(cancelled / nullif(total, 0), 0) into v_cancel_rate from c;

  -- Dispute loss rate
  with d as (
    select
      count(*) filter (where event_type = 'dispute_lost')::numeric as lost,
      greatest(count(*) filter (where event_type in ('dispute_won','dispute_lost')), 1)::numeric as total
    from public.trust_events
    where profile_id = p_profile
  )
  select coalesce(lost / total, 0) into v_dispute_loss_rate from d;

  -- Composite (see workflow doc §6)
  v_score := round(
      40 * (v_avg_stars / 5.0)
    + 15 * v_tag_net_score
    + 15 * least(1.0, log(1 + v_tx_count::numeric) / 2.0)
    + 10 * v_verify_score
    +  8 * v_response_score
    +  7 * (1 - v_cancel_rate)
    -  5 * v_dispute_loss_rate
  )::integer;

  v_score := greatest(0, least(100, v_score));

  v_tier := case
    when v_score >= 80 then 'platinum'::trust_tier
    when v_score >= 60 then 'gold'::trust_tier
    when v_score >= 40 then 'silver'::trust_tier
    when v_score >= 20 then 'bronze'::trust_tier
    else 'new'::trust_tier
  end;

  -- Update denormalized fields
  update public.profiles
    set trust_score = v_score,
        trust_tier  = v_tier,
        seller_rating = (
          select coalesce(avg(stars), 0)::numeric(3,2)
            from public.ratings
           where ratee_id = p_profile and role_rated = 'seller' and is_visible = true
        ),
        buyer_rating = (
          select coalesce(avg(stars), 0)::numeric(3,2)
            from public.ratings
           where ratee_id = p_profile and role_rated = 'buyer'  and is_visible = true
        ),
        seller_tx_count = (
          select count(*) from public.transactions
           where seller_id = p_profile and state = 'released'
        ),
        buyer_tx_count = (
          select count(*) from public.transactions
           where buyer_id = p_profile and state = 'released'
        ),
        median_response_seconds = v_median_resp
    where id = p_profile;

  return v_score;
end;
$$;

-- Recompute everyone nightly at 04:00 UTC
select cron.schedule(
  'recalc-trust-nightly',
  '0 4 * * *',
  $$
    select public.recalc_trust_score(id) from public.profiles where is_banned = false;
  $$
);

-- Recompute target when a new visible rating lands
create or replace function public.on_rating_visible()
returns trigger language plpgsql as $$
begin
  if new.is_visible and (old is null or old.is_visible = false) then
    perform public.recalc_trust_score(new.ratee_id);
  end if;
  return new;
end;
$$;

create trigger ratings_recalc
  after insert or update of is_visible on public.ratings
  for each row execute function public.on_rating_visible();

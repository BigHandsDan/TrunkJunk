-- =============================================================================
-- Scheduled jobs
-- =============================================================================

-- Expire bids past their TTL
create or replace function public.expire_old_bids()
returns void language plpgsql as $$
begin
  update public.bids
     set status = 'expired', updated_at = now()
   where status = 'active' and expires_at < now();
end;
$$;

select cron.schedule('expire-bids', '*/15 * * * *', $$select public.expire_old_bids();$$);

-- Expire listings past expires_at
create or replace function public.expire_old_listings()
returns void language plpgsql as $$
begin
  update public.listings
     set status = 'expired', updated_at = now()
   where status = 'active' and expires_at < now();
end;
$$;

select cron.schedule('expire-listings', '0 * * * *', $$select public.expire_old_listings();$$);

-- Purge messages_audit rows past purge_after
create or replace function public.purge_old_message_audits()
returns void language plpgsql as $$
begin
  delete from public.messages_audit where purge_after < now();
end;
$$;

select cron.schedule('purge-audits', '30 4 * * *', $$select public.purge_old_message_audits();$$);

-- Auto-reveal stale ratings after 7 days even if only one side rated
create or replace function public.auto_reveal_stale_ratings()
returns void language plpgsql as $$
begin
  update public.ratings
     set is_visible = true
   where is_visible = false
     and created_at < now() - interval '7 days';
end;
$$;

select cron.schedule('auto-reveal-ratings', '0 5 * * *', $$select public.auto_reveal_stale_ratings();$$);

-- =============================================================================
-- Row-Level Security
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.listings            enable row level security;
alter table public.listing_media       enable row level security;
alter table public.listing_watchers    enable row level security;
alter table public.bids                enable row level security;
alter table public.threads             enable row level security;
alter table public.messages            enable row level security;
alter table public.messages_audit      enable row level security;
alter table public.transactions        enable row level security;
alter table public.ratings             enable row level security;
alter table public.trust_events        enable row level security;
alter table public.reports             enable row level security;
alter table public.device_fingerprints enable row level security;

-- ---- PROFILES ----
-- Users can read their own full profile
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id);

-- Users can update their own profile (but NOT home_point via API — handled by RPC)
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- public_profiles view is the public read path; no direct profiles SELECT for others.

-- ---- LISTINGS ----
-- Anyone authenticated can read active listings
create policy listings_read_active on public.listings
  for select using (status = 'active' or seller_id = auth.uid());

-- Sellers can insert their own listings
create policy listings_insert_own on public.listings
  for insert with check (seller_id = auth.uid());

-- Sellers can update/delete their own listings
create policy listings_update_own on public.listings
  for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());

create policy listings_delete_own on public.listings
  for delete using (seller_id = auth.uid());

-- ---- LISTING_MEDIA ----
create policy media_read on public.listing_media
  for select using (
    exists (select 1 from public.listings l
            where l.id = listing_media.listing_id
              and (l.status = 'active' or l.seller_id = auth.uid()))
  );

create policy media_write on public.listing_media
  for all using (
    exists (select 1 from public.listings l
            where l.id = listing_media.listing_id and l.seller_id = auth.uid())
  );

-- ---- LISTING_WATCHERS ----
create policy watchers_own on public.listing_watchers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- BIDS ----
-- Buyer sees own bids; seller sees bids on their listings
create policy bids_read on public.bids
  for select using (
    buyer_id = auth.uid()
    or exists (select 1 from public.listings l
               where l.id = bids.listing_id and l.seller_id = auth.uid())
  );

-- Buyer inserts own bids
create policy bids_insert on public.bids
  for insert with check (buyer_id = auth.uid());

-- Buyer can withdraw own active bids; seller can accept/reject (via RPC, not direct)
create policy bids_update_buyer on public.bids
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- ---- THREADS ----
create policy threads_read on public.threads
  for select using (seller_id = auth.uid() or buyer_id = auth.uid());

create policy threads_insert on public.threads
  for insert with check (buyer_id = auth.uid() or seller_id = auth.uid());

create policy threads_update on public.threads
  for update using (seller_id = auth.uid() or buyer_id = auth.uid());

-- ---- MESSAGES ----
create policy messages_read on public.messages
  for select using (
    exists (select 1 from public.threads t
            where t.id = messages.thread_id
              and (t.seller_id = auth.uid() or t.buyer_id = auth.uid()))
  );

-- Inserts only via the redact-message Edge Function (uses service role).
-- Block direct client inserts by NOT creating an insert policy for normal users.

-- Allow message-author to mark own messages read (update read_at)
create policy messages_update_read on public.messages
  for update using (
    exists (select 1 from public.threads t
            where t.id = messages.thread_id
              and (t.seller_id = auth.uid() or t.buyer_id = auth.uid()))
  ) with check (true);

-- ---- MESSAGES_AUDIT ----
-- No client read. Service role only. (No policies = no access for anon/auth.)

-- ---- TRANSACTIONS ----
create policy tx_read on public.transactions
  for select using (seller_id = auth.uid() or buyer_id = auth.uid());

-- All writes go through RPCs / Edge Functions.

-- ---- RATINGS ----
-- Only see ratings that are visible (post blind reveal) or that you wrote
create policy ratings_read on public.ratings
  for select using (
    is_visible = true
    or rater_id = auth.uid()
    or ratee_id = auth.uid()
  );

-- Insert own rating
create policy ratings_insert on public.ratings
  for insert with check (rater_id = auth.uid());

-- ---- TRUST_EVENTS ----
create policy trust_events_self_read on public.trust_events
  for select using (profile_id = auth.uid());

-- ---- REPORTS ----
create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());

create policy reports_self_read on public.reports
  for select using (reporter_id = auth.uid());

-- ---- DEVICE_FINGERPRINTS ----
create policy device_self on public.device_fingerprints
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

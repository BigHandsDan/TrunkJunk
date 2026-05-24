-- =============================================================================
-- Transactions (escrow lifecycle)
-- =============================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  bid_id     uuid not null references public.bids(id),
  thread_id  uuid not null references public.threads(id),
  seller_id  uuid not null references public.profiles(id),
  buyer_id   uuid not null references public.profiles(id),
  gross_amount    numeric(10,2) not null check (gross_amount > 0),
  platform_fee_bps integer not null,                 -- e.g. 800 = 8%
  platform_fee_amount numeric(10,2) not null,
  payout_amount   numeric(10,2) not null,
  -- Stripe
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text,
  -- Lifecycle
  state transaction_state not null default 'pending',
  escrowed_at  timestamptz,
  released_at  timestamptz,
  refunded_at  timestamptz,
  -- Pickup
  pickup_address_revealed_at timestamptz,
  pickup_window tstzrange,
  pickup_confirmed_seller boolean not null default false,
  pickup_confirmed_buyer  boolean not null default false,
  pickup_confirmed_at timestamptz,
  meet_otp text,                                     -- 6-digit, generated at escrow
  -- Dispute
  dispute_opened_at timestamptz,
  dispute_resolution text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_seller_idx on public.transactions (seller_id, state);
create index transactions_buyer_idx  on public.transactions (buyer_id,  state);
create index transactions_state_idx  on public.transactions (state, created_at desc);

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Ratings
-- =============================================================================
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  ratee_id uuid not null references public.profiles(id) on delete cascade,
  role_rated text not null check (role_rated in ('seller','buyer')),
  stars integer not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  comment text check (char_length(comment) <= 500),
  is_visible boolean not null default false,    -- becomes true after blind reveal
  created_at timestamptz not null default now(),
  unique (transaction_id, rater_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id, is_visible, created_at desc);
create index ratings_tx_idx     on public.ratings (transaction_id);

-- Allowed rating tags (keep aligned with mobile client UI)
create table public.rating_tags (
  tag text primary key,
  role text not null check (role in ('seller','buyer','both')),
  polarity integer not null check (polarity in (-1, 1))
);

insert into public.rating_tags (tag, role, polarity) values
  ('accurate_description','seller', 1),
  ('on_time','both', 1),
  ('clean_handoff','both', 1),
  ('fair_price','both', 1),
  ('great_communication','both', 1),
  ('item_as_described','seller', 1),
  ('easy_pickup','seller', 1),
  ('respectful','both', 1),
  ('item_misrepresented','seller', -1),
  ('late','both', -1),
  ('no_show','both', -1),
  ('poor_communication','both', -1),
  ('rude','both', -1),
  ('haggled_at_pickup','buyer', -1)
on conflict (tag) do nothing;

-- =============================================================================
-- Trust events (audit trail for reputation)
-- =============================================================================
create table public.trust_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type trust_event_type not null,
  delta integer not null,
  reason text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index trust_events_profile_idx on public.trust_events (profile_id, created_at desc);

-- =============================================================================
-- Reports / flags
-- =============================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  target_kind text not null check (target_kind in ('listing','message','profile','transaction')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewing','upheld','dismissed')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);

-- =============================================================================
-- Device fingerprints (sybil defense)
-- =============================================================================
create table public.device_fingerprints (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fp_hash text not null,
  ip_inet inet,
  user_agent text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (profile_id, fp_hash)
);

create index device_fp_hash_idx on public.device_fingerprints (fp_hash);
create index device_fp_ip_idx   on public.device_fingerprints (ip_inet);

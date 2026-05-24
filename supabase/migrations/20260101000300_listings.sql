-- =============================================================================
-- Listings + media
-- =============================================================================
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 80),
  description text not null check (char_length(description) between 10 and 4000),
  category listing_category not null,
  subcategory text,
  condition listing_condition not null,
  -- Pricing
  ask_price numeric(10,2) check (ask_price >= 0),
  min_bid   numeric(10,2) check (min_bid   >= 0),
  buy_now_price numeric(10,2) check (buy_now_price >= 0),
  accepts_bids boolean not null default true,
  -- Physical
  weight_lbs integer check (weight_lbs >= 0),
  dims_in jsonb,
  pickup_only boolean not null default true,
  pickup_window tstzrange,
  -- Geo (TRUE location — never exposed)
  pickup_point geography(point, 4326) not null,
  pickup_h3_r8 text not null,
  pickup_zip3 text,
  -- Lifecycle
  status listing_status not null default 'draft',
  expires_at timestamptz not null default now() + interval '30 days',
  view_count integer not null default 0,
  bid_count  integer not null default 0,
  -- AI moderation
  ai_flags jsonb,                 -- { nudity: false, prohibited: false, weapon: false, ... }
  ai_labels jsonb,                -- detected labels/objects
  embedding vector(384),          -- for recommendations
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_status_cat_idx   on public.listings (status, category, created_at desc);
create index listings_seller_idx        on public.listings (seller_id, status);
create index listings_pickup_point_idx  on public.listings using gist (pickup_point);
create index listings_pickup_h3_idx     on public.listings (pickup_h3_r8);
create index listings_title_trgm        on public.listings using gin (title gin_trgm_ops);
create index listings_desc_trgm         on public.listings using gin (description gin_trgm_ops);
create index listings_active_partial    on public.listings (created_at desc) where status = 'active';

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- Media
create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  r2_key text not null,
  width integer,
  height integer,
  display_order integer not null default 0,
  ai_safe boolean not null default false,
  ai_labels jsonb,
  created_at timestamptz not null default now()
);

create index listing_media_listing_idx on public.listing_media (listing_id, display_order);

-- Listing watchers (Phase 2: saved listings)
create table public.listing_watchers (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

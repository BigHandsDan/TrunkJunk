-- =============================================================================
-- Profiles — extends auth.users
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  id_verified boolean not null default false,
  -- Geo (private). home_point is NEVER exposed via API.
  home_point geography(point, 4326),
  home_h3_r8 text,
  home_zip3 text,
  -- Stripe
  stripe_account_id text unique,         -- Connect account for payouts
  stripe_customer_id text unique,        -- Customer for purchases
  stripe_onboarded boolean not null default false,
  -- Reputation (denormalized for fast reads; recomputed nightly)
  seller_rating numeric(3,2) check (seller_rating between 0 and 5),
  buyer_rating  numeric(3,2) check (buyer_rating  between 0 and 5),
  seller_tx_count integer not null default 0,
  buyer_tx_count  integer not null default 0,
  trust_score integer not null default 0 check (trust_score between 0 and 100),
  trust_tier  trust_tier not null default 'new',
  -- Response time (computed)
  median_response_seconds integer,
  -- Moderation
  is_banned boolean not null default false,
  banned_reason text,
  banned_at timestamptz,
  -- Referral
  referral_code text unique,
  referred_by uuid references public.profiles(id),
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_home_point_idx on public.profiles using gist (home_point);
create index profiles_home_h3_idx    on public.profiles (home_h3_r8);
create index profiles_trust_idx      on public.profiles (trust_tier, trust_score desc);
create index profiles_display_trgm   on public.profiles using gin (display_name gin_trgm_ops);

-- Trigger: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Trigger: auto-create profile row when auth.users row created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_display text;
  v_code text;
begin
  v_display := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1),
    'User-' || substr(new.id::text, 1, 6)
  );
  v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 7));

  insert into public.profiles (id, display_name, referral_code)
  values (new.id, v_display, v_code);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Public-safe view of profiles (NEVER exposes home_point)
create view public.public_profiles
with (security_invoker = on)
as
select
  id,
  display_name,
  avatar_url,
  bio,
  phone_verified,
  email_verified,
  id_verified,
  seller_rating,
  buyer_rating,
  seller_tx_count,
  buyer_tx_count,
  trust_tier,
  home_h3_r8,
  created_at
from public.profiles
where is_banned = false;

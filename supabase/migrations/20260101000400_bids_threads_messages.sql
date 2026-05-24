-- =============================================================================
-- Bids
-- =============================================================================
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status bid_status not null default 'active',
  expires_at timestamptz not null default now() + interval '48 hours',
  message text check (char_length(message) <= 280),
  is_buy_now boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bids_listing_status_idx on public.bids (listing_id, status, amount desc);
create index bids_buyer_idx           on public.bids (buyer_id, status);
create unique index bids_one_active_per_buyer
  on public.bids (listing_id, buyer_id) where status = 'active';

create trigger bids_updated_at
  before update on public.bids
  for each row execute function public.set_updated_at();

-- Prevent sellers bidding on their own listings
create or replace function public.guard_self_bid()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.listings l
    where l.id = new.listing_id and l.seller_id = new.buyer_id
  ) then
    raise exception 'Cannot bid on your own listing';
  end if;
  return new;
end;
$$;

create trigger bids_no_self before insert on public.bids
  for each row execute function public.guard_self_bid();

-- Maintain bid_count on listing
create or replace function public.bump_bid_count()
returns trigger language plpgsql as $$
begin
  update public.listings set bid_count = bid_count + 1 where id = new.listing_id;
  return new;
end;
$$;

create trigger bids_bump_count after insert on public.bids
  for each row execute function public.bump_bid_count();

-- =============================================================================
-- Threads + messages
-- =============================================================================
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  bid_id     uuid references public.bids(id),
  state      thread_state not null default 'open',
  last_message_at timestamptz,
  unread_seller integer not null default 0,
  unread_buyer  integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create index threads_seller_idx on public.threads (seller_id, last_message_at desc nulls last);
create index threads_buyer_idx  on public.threads (buyer_id,  last_message_at desc nulls last);

create trigger threads_updated_at
  before update on public.threads
  for each row execute function public.set_updated_at();

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body_clean text not null check (char_length(body_clean) between 1 and 2000),
  redactions jsonb not null default '{}'::jsonb,
  flagged boolean not null default false,
  attachment_r2_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (thread_id, created_at);

-- Audit table for original (un-redacted) message bodies — restricted access
create table public.messages_audit (
  message_id uuid primary key references public.messages(id) on delete cascade,
  body_raw text not null,
  created_at timestamptz not null default now(),
  -- Auto-purge after 30 days via pg_cron
  purge_after timestamptz not null default now() + interval '30 days'
);

-- Trigger: bump thread.last_message_at + unread counts
create or replace function public.on_message_inserted()
returns trigger language plpgsql as $$
declare
  v_seller uuid;
  v_buyer  uuid;
begin
  select seller_id, buyer_id into v_seller, v_buyer
  from public.threads where id = new.thread_id;

  update public.threads
     set last_message_at = new.created_at,
         unread_seller = case when new.sender_id = v_buyer  then unread_seller + 1 else unread_seller end,
         unread_buyer  = case when new.sender_id = v_seller then unread_buyer  + 1 else unread_buyer  end
   where id = new.thread_id;
  return new;
end;
$$;

create trigger messages_bump after insert on public.messages
  for each row execute function public.on_message_inserted();

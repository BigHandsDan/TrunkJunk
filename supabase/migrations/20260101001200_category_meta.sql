-- =============================================================================
-- Category metadata (readable from the app for descriptions/examples)
-- and weight column for scrap/parts listings.
-- =============================================================================

-- Add weight column to listings for scrap/parts pricing (lbs).
alter table public.listings
  add column if not exists weight_lbs numeric(10,2);

-- Per-category metadata, mirrored from packages/shared/src/categories.ts so
-- the data lives in one place that both clients and admin can read.
create table if not exists public.category_meta (
  category      listing_category primary key,
  label         text not null,
  short         text not null,
  description   text not null,
  examples      text[] not null default '{}',
  excludes      text[] not null default '{}',
  weight_required        boolean not null default false,
  require_serial_photo   boolean not null default false,
  sort_order    int not null default 0,
  updated_at    timestamptz not null default now()
);

insert into public.category_meta
  (category, label, short, description, examples, excludes, weight_required, require_serial_photo, sort_order)
values
  ('standard', 'Standard Junk',
   'Whole, usable items in fair-to-good shape.',
   'Intact items someone would buy and use as-is. No power required, no major damage. If it works the way it''s supposed to and looks presentable, list it here.',
   array['Coffee table','Bookshelf','Dresser','Office chair','Bike','Patio set','Mirror','Area rug'],
   array['Anything that plugs in (use Electronics)','Broken-but-useful-for-parts items (use Parts)'],
   false, false, 1),

  ('electronics', 'Electronics Junk',
   'Anything that plugs in or runs on batteries.',
   'Any item that requires a power source — wall plug, battery, solar — to function. Includes working and broken electronics. TVs, computers, phones, power tools, gaming consoles, kitchen small-appliances, hairdryers, e-bikes, drones, smart-home devices. Listings should include a photo of the model/serial sticker when possible.',
   array['TV / monitor','Laptop / desktop','Phone / tablet','Game console','Power tool (battery or corded)','Microwave / air fryer','Vacuum','E-bike / scooter','Speakers / soundbar'],
   array['Battery-dead-but-priced-for-parts items (use Parts)','Pure metal value with no working components (use Scrap)'],
   false, true, 2),

  ('household', 'Household Junk',
   'Everyday house items — décor, kitchenware, textiles.',
   'Non-powered home items used day-to-day. Pots and pans, dishes, linens, decor, small furniture pieces, hand tools, garden items, books in bulk. If it lives inside a house and doesn''t plug in, this is usually the right home.',
   array['Pots and pans set','Dish set','Bedding / linens','Curtains','Wall art / frames','Hand tools','Garden pots','Books (bulk)','Holiday decor'],
   array['Anything powered (use Electronics)','Major furniture pieces (use Standard)'],
   false, false, 3),

  ('parts', 'Parts Junk',
   'Broken or incomplete items kept for harvestable parts.',
   'Items that don''t fully work but contain valuable components a buyer can pull. Engines, transmissions, broken appliances with good compressors, dead laptops with intact screens, bike frames missing wheels. Sellers must clearly state what''s broken and what''s salvageable.',
   array['Engine block','Transmission','Broken washer (good motor)','Dead laptop (screen ok)','Frame-only bike','Donor furniture (good hardware)','Sewing machine for parts'],
   array['Fully working items (use the matching category)','Pure metal scrap with no usable parts (use Scrap)'],
   false, false, 4),

  ('scrap', 'Scrap Junk',
   'Items valued for the metal/material that can be recycled.',
   'Items priced by weight or recyclable material, not by function. Copper wire, aluminum siding, steel rebar, brass fixtures, catalytic converters, old radiators — anything a scrap yard pays for. Buyers here are usually scrappers and metal recyclers.',
   array['Copper pipe / wire','Aluminum cans / siding','Steel / iron','Brass fittings','Stainless sinks','Old radiators','Lead','Cast iron tubs'],
   array['Working appliances (use Electronics or Household)','Items priced for resale, not weight (use Standard or Parts)'],
   true, false, 5)
on conflict (category) do update set
  label = excluded.label,
  short = excluded.short,
  description = excluded.description,
  examples = excluded.examples,
  excludes = excluded.excludes,
  weight_required = excluded.weight_required,
  require_serial_photo = excluded.require_serial_photo,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.category_meta enable row level security;

-- Anyone (incl. anon) can read category metadata — it's public reference data.
drop policy if exists category_meta_select on public.category_meta;
create policy category_meta_select on public.category_meta
  for select to anon, authenticated using (true);

-- Enforce scrap weight at insert/update time via a trigger so the rule lives in the DB.
create or replace function public.enforce_listing_category_rules()
returns trigger
language plpgsql
as $$
declare
  meta public.category_meta%rowtype;
begin
  select * into meta from public.category_meta where category = new.category;
  if meta.weight_required and (new.weight_lbs is null or new.weight_lbs <= 0) then
    raise exception 'category % requires weight_lbs > 0', new.category
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_enforce_category_rules on public.listings;
create trigger listings_enforce_category_rules
  before insert or update of category, weight_lbs on public.listings
  for each row execute function public.enforce_listing_category_rules();

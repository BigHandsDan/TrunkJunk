-- =============================================================================
-- Extensions
-- =============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gist";
create extension if not exists "pg_cron" with schema "extensions";
create extension if not exists "vector"; -- pgvector for Phase 2 recs

-- H3 spatial indexing (Uber). If unavailable on hosted Supabase, fall back to geohash.
-- We'll compute H3 cells in the application layer using h3-js if the extension isn't available.
-- create extension if not exists "h3";

-- Custom utility: clamp a number to a range
create or replace function clamp(v numeric, lo numeric, hi numeric)
returns numeric language sql immutable as $$
  select greatest(lo, least(hi, v));
$$;

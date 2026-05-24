-- Internal helper for reveal-address Edge Function
create or replace function public.decode_pickup_point(p_listing uuid)
returns table (lat double precision, lng double precision)
language sql
security definer
set search_path = public
as $$
  select ST_Y(pickup_point::geometry), ST_X(pickup_point::geometry)
  from public.listings where id = p_listing;
$$;
-- Note: not granted to authenticated. Only callable via service_role.
revoke all on function public.decode_pickup_point(uuid) from public, anon, authenticated;

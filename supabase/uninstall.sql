-- Removes everything supabase/schema.sql created (all of it is prefixed inv_), and nothing else.
-- Use it to take Stock Scanner out of a project that also hosts other apps.
-- It is safe to run more than once.

drop function if exists public.inv_reset_demo();
drop function if exists public.inv_seed();
drop function if exists public.inv_warehouses();
drop function if exists public.inv_low_stock();
drop function if exists public.inv_adjust_stock(text, text, numeric, text);
drop function if exists public.inv_lookup_item(text);

-- The tables reference each other, so drop them children first (their policies go with them).
drop table if exists public.inv_moves;
drop table if exists public.inv_stock;
drop table if exists public.inv_products;
drop table if exists public.inv_warehouses;

-- Stock Scanner demo database for Supabase. Run this once in the SQL editor.
-- It is safe to run again (it also puts the demo data back), and it can share a project with
-- other apps: everything here is prefixed inv_.
--
-- The catalogue is the same 12 items, barcodes and quantities as the Inventory Hub ERPNext demo.
--
-- Security: browsers can read the tables but never write to them. Every change goes through a
-- SECURITY DEFINER function, which keeps stock from going negative. This is a public demo, so the
-- functions (including inv_reset_demo) are open to the anon role.

create table if not exists public.inv_warehouses (
  name text primary key
);

create table if not exists public.inv_products (
  item_code text primary key,
  item_name text not null,
  barcode   text not null unique,
  stock_uom text not null default 'Nos'
);

create table if not exists public.inv_stock (
  item_code     text not null references public.inv_products (item_code) on delete cascade,
  warehouse     text not null references public.inv_warehouses (name) on delete cascade,
  qty           numeric not null default 0 check (qty >= 0),
  reorder_level numeric,
  reorder_qty   numeric,
  primary key (item_code, warehouse)
);

create table if not exists public.inv_moves (
  id         bigint generated always as identity primary key,
  item_code  text not null,
  warehouse  text not null,
  qty_change numeric not null,
  qty_after  numeric not null,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.inv_warehouses enable row level security;
alter table public.inv_products   enable row level security;
alter table public.inv_stock      enable row level security;
alter table public.inv_moves      enable row level security;

drop policy if exists "read warehouses" on public.inv_warehouses;
drop policy if exists "read products"   on public.inv_products;
drop policy if exists "read stock"      on public.inv_stock;
drop policy if exists "read moves"      on public.inv_moves;
create policy "read warehouses" on public.inv_warehouses for select using (true);
create policy "read products"   on public.inv_products   for select using (true);
create policy "read stock"      on public.inv_stock      for select using (true);
create policy "read moves"      on public.inv_moves      for select using (true);

-- Look an item up by barcode or item code. Same JSON shape as the Inventory Hub ERPNext API.
create or replace function public.inv_lookup_item(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code  text := trim(coalesce(p_code, ''));
  v_item  public.inv_products;
  v_stock jsonb;
  v_total numeric;
  v_low   boolean;
begin
  if v_code = '' then
    raise exception 'Scan or enter a barcode.';
  end if;

  select * into v_item
    from inv_products
   where barcode = v_code or lower(item_code) = lower(v_code)
   limit 1;

  if not found then
    raise exception 'No item found for %.', v_code using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'warehouse', warehouse,
           'qty', qty,
           'reorder_level', reorder_level,
           'reorder_qty', reorder_qty,
           'low', reorder_level is not null and qty <= reorder_level
         ) order by warehouse), '[]'::jsonb),
         coalesce(sum(qty), 0),
         coalesce(bool_or(reorder_level is not null and qty <= reorder_level), false)
    into v_stock, v_total, v_low
    from inv_stock
   where item_code = v_item.item_code;

  return jsonb_build_object(
    'item_code', v_item.item_code,
    'item_name', v_item.item_name,
    'stock_uom', v_item.stock_uom,
    'scanned', p_code,
    'total_qty', v_total,
    'low_stock', v_low,
    'stock', v_stock
  );
end;
$$;

-- Add (positive) or remove (negative) stock. The row is locked while it changes, so two people
-- scanning at once can't both take the last unit.
create or replace function public.inv_adjust_stock(
  p_item_code text,
  p_warehouse text,
  p_qty       numeric,
  p_note      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_qty  numeric;
begin
  if p_qty is null or p_qty = 0 then
    raise exception 'Quantity must not be zero.';
  end if;

  select item_name into v_name from inv_products where item_code = p_item_code;
  if not found then
    raise exception 'Item % does not exist.', p_item_code using errcode = 'P0002';
  end if;
  if not exists (select 1 from inv_warehouses where name = p_warehouse) then
    raise exception 'Warehouse % does not exist.', p_warehouse using errcode = 'P0002';
  end if;

  -- Receiving into a warehouse the item has never been in creates its row.
  insert into inv_stock (item_code, warehouse, qty)
  values (p_item_code, p_warehouse, 0)
  on conflict (item_code, warehouse) do nothing;

  select qty into v_qty
    from inv_stock
   where item_code = p_item_code and warehouse = p_warehouse
     for update;

  if v_qty + p_qty < 0 then
    raise exception 'Not enough stock: % has % in %, cannot remove %.', v_name, v_qty, p_warehouse, -p_qty;
  end if;

  update inv_stock
     set qty = qty + p_qty
   where item_code = p_item_code and warehouse = p_warehouse
  returning qty into v_qty;

  insert into inv_moves (item_code, warehouse, qty_change, qty_after, note)
  values (p_item_code, p_warehouse, p_qty, v_qty, p_note);

  return jsonb_build_object('item_code', p_item_code, 'warehouse', p_warehouse, 'change', p_qty, 'qty', v_qty);
end;
$$;

-- Everything at or below its reorder level, worst first.
create or replace function public.inv_low_stock()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_code', s.item_code,
           'item_name', p.item_name,
           'warehouse', s.warehouse,
           'qty', s.qty,
           'reorder_level', s.reorder_level,
           'reorder_qty', s.reorder_qty
         ) order by s.qty / nullif(s.reorder_level, 0), p.item_name), '[]'::jsonb)
    from inv_stock s
    join inv_products p using (item_code)
   where s.reorder_level is not null and s.qty <= s.reorder_level;
$$;

create or replace function public.inv_warehouses()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb) from inv_warehouses;
$$;

-- Put the demo data back exactly as it ships. Also used to load it the first time.
create or replace function public.inv_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from inv_moves where true;
  delete from inv_stock where true;
  delete from inv_products where true;
  delete from inv_warehouses where true;

  insert into inv_warehouses (name) values ('Stores - DRC'), ('Display Shelf - DRC');

  insert into inv_products (item_code, item_name, barcode) values
    ('BOND-A4',    'Bond Paper A4 (ream)',        '4800010000016'),
    ('PEN-BLU-12', 'Ballpen Blue (box of 12)',    '4800010000023'),
    ('PEN-BLK-12', 'Ballpen Black (box of 12)',   '4800010000030'),
    ('MRK-BLK',    'Marker Permanent Black',      '4800010000047'),
    ('NB-80',      'Notebook 80 Leaves',          '4800010000054'),
    ('STP-35',     'Stapler No. 35',              '4800010000061'),
    ('STPW-35',    'Staple Wire No. 35 (box)',    '4800010000078'),
    ('TAPE-MSK',   'Masking Tape 1 inch',         '4800010000085'),
    ('ENV-L50',    'Envelope Long (pack of 50)',  '4800010000092'),
    ('HL-YEL',     'Highlighter Yellow',          '4800010000108'),
    ('CT-5MM',     'Correction Tape 5mm',         '4800010000115'),
    ('ALC-500',    'Alcohol 70% 500ml',           '4800010000122');

  insert into inv_stock (item_code, warehouse, qty, reorder_level, reorder_qty) values
    ('BOND-A4',    'Stores - DRC',        45, 20,  60),
    ('PEN-BLU-12', 'Stores - DRC',        32, 15,  40),
    ('PEN-BLU-12', 'Display Shelf - DRC',  4,  6,  12),
    ('PEN-BLK-12', 'Stores - DRC',         6, 15,  40),
    ('MRK-BLK',    'Stores - DRC',        18, 24,  48),
    ('NB-80',      'Stores - DRC',       120, 30, 100),
    ('NB-80',      'Display Shelf - DRC', 12,  5,  12),
    ('STP-35',     'Stores - DRC',         9,  5,  12),
    ('STPW-35',    'Stores - DRC',        50, 20,  60),
    ('TAPE-MSK',   'Stores - DRC',         4, 12,  36),
    ('ENV-L50',    'Stores - DRC',        22, 10,  30),
    ('HL-YEL',     'Stores - DRC',        40, 20,  60),
    ('HL-YEL',     'Display Shelf - DRC', 15,  6,  12),
    ('CT-5MM',     'Stores - DRC',        30, 12,  36),
    ('ALC-500',    'Stores - DRC',         3, 10,  24);
end;
$$;

create or replace function public.inv_reset_demo()
returns void
language sql
security definer
set search_path = public
as $$
  select public.inv_seed();
$$;

grant execute on function public.inv_lookup_item(text)                     to anon, authenticated;
grant execute on function public.inv_adjust_stock(text, text, numeric, text) to anon, authenticated;
grant execute on function public.inv_low_stock()                           to anon, authenticated;
grant execute on function public.inv_warehouses()                          to anon, authenticated;
grant execute on function public.inv_reset_demo()                          to anon, authenticated;
-- inv_seed() is only called by inv_reset_demo() and by the line below, not by browsers.
revoke execute on function public.inv_seed() from public, anon, authenticated;

select public.inv_seed();

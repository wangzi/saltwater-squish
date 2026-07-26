create table if not exists products (
  id text primary key,
  sku text not null unique,
  name text not null,
  subtitle text not null default '',
  description text not null default '',
  collection text not null default 'Shop',
  tag text not null default '',
  feel text not null,
  status text not null default 'published' check (status in ('draft', 'published')),
  sort_order integer not null default 999,
  price numeric(10, 2),
  inventory_quantity integer,
  image_position_x integer not null default 0,
  image_position_y integer not null default 0,
  categories text[] not null default '{}',
  aliases text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_sort_idx
  on products (status, sort_order)
  where deleted_at is null;

create index if not exists products_sku_idx on products (sku);

create or replace function set_products_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;

create trigger products_updated_at
before update on products
for each row
execute function set_products_updated_at();

alter table products enable row level security;

create policy "Public read published products"
  on products
  for select
  using (deleted_at is null and status = 'published');

-- WarrantyApp Database Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ikfuafcygrfwgayxzwbz/sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- USERS (extends Supabase auth.users)
-- ─────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  username text unique,
  push_token text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view and edit own profile"
  on public.profiles for all using (auth.uid() = id);

-- ─────────────────────────────────────────
-- ITEMS (possessions)
-- ─────────────────────────────────────────
create table public.items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  brand text,
  model text,
  serial_number text,
  category text,               -- Electronics, Appliances, Vehicles, Toys, Food, etc.
  purchase_date date,
  receipt_url text,
  notes text,
  created_at timestamptz default now()
);
alter table public.items enable row level security;
create policy "Users can manage own items"
  on public.items for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- WARRANTIES
-- ─────────────────────────────────────────
create table public.warranties (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references public.items(id) on delete cascade not null,
  start_date date,
  end_date date,
  coverage_notes text,
  document_url text,
  created_at timestamptz default now()
);
alter table public.warranties enable row level security;
create policy "Users can manage warranties for own items"
  on public.warranties for all
  using (exists (select 1 from public.items where items.id = warranties.item_id and items.user_id = auth.uid()));

-- ─────────────────────────────────────────
-- RECALLS (from government APIs)
-- ─────────────────────────────────────────
create table public.recalls (
  id uuid primary key default uuid_generate_v4(),
  source text not null,        -- CPSC, NHTSA, FDA, USDA, EPA
  external_id text unique,     -- ID from the source agency
  title text not null,
  description text,
  hazard text,
  remedy text,
  affected_products jsonb,     -- array of brand/model/category info
  recall_date date,
  url text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- ITEM_RECALLS (matches between user items and recalls)
-- ─────────────────────────────────────────
create table public.item_recalls (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references public.items(id) on delete cascade not null,
  recall_id uuid references public.recalls(id) on delete cascade not null,
  notified_at timestamptz default now(),
  acknowledged_at timestamptz,
  unique(item_id, recall_id)
);
alter table public.item_recalls enable row level security;
create policy "Users can view recall matches for own items"
  on public.item_recalls for select
  using (exists (select 1 from public.items where items.id = item_recalls.item_id and items.user_id = auth.uid()));

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete set null,
  recall_id uuid references public.recalls(id) on delete set null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Users can view own notifications"
  on public.notifications for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- OWNERSHIP TRANSFERS
-- ─────────────────────────────────────────
create table public.ownership_transfers (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references public.items(id) on delete cascade not null,
  from_user_id uuid references public.profiles(id) not null,
  to_user_id uuid references public.profiles(id) not null,
  transferred_at timestamptz default now(),
  notes text
);
alter table public.ownership_transfers enable row level security;
create policy "Users can view own transfer history"
  on public.ownership_transfers for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

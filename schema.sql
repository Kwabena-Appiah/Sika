-- ============================================================
-- Sika — Ghana VAT compliance : PostgreSQL schema
-- Run once against an empty database:  psql "$DATABASE_URL" -f schema.sql
-- ============================================================

create extension if not exists pgcrypto;   -- provides gen_random_uuid()

-- ---- users ----
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  created_at    timestamptz not null default now()
);

-- ---- businesses ----
-- A business is an entity; it is NOT owned by a column on itself.
-- Access is granted through memberships, so one accountant can hold many.
create table if not exists businesses (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  tin             text,
  supply_type     text not null default 'goods' check (supply_type in ('goods','services')),
  annual_turnover numeric(14,2) not null default 0 check (annual_turnover >= 0),
  created_at      timestamptz not null default now()
);

-- ---- memberships (the many-to-many that makes multi-entity work) ----
create table if not exists memberships (
  user_id     uuid not null references users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner','accountant','viewer')),
  created_at  timestamptz not null default now(),
  primary key (user_id, business_id)
);

-- ---- transactions ----
-- MONEY IS NUMERIC, NEVER float. amount is what the user typed;
-- vat_inclusive records whether VAT was already inside that figure.
create table if not exists transactions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  description   text not null,
  amount        numeric(14,2) not null check (amount >= 0),
  vat_inclusive boolean not null default false,
  type          text not null check (type in ('sale','purchase')),
  txn_date      date not null default current_date,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_txn_business_date on transactions (business_id, txn_date);

-- ---- invoices + lines ----
create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  invoice_no    text not null,
  customer_name text,
  issue_date    date not null default current_date,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (business_id, invoice_no)
);

create table if not exists invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(12,3) not null default 1 check (quantity >= 0),
  unit_price  numeric(14,2) not null default 0 check (unit_price >= 0)
);

-- ============================================================
-- NEXT-STEP (not used by the v1 API, documented in README):
-- effective-dated rates so a 2025 transaction computes at 2025
-- rates and a 2026 one at Act 1151 rates. When you add this,
-- swap config/rates.js for a lookup on txn_date.
--
-- create table tax_rates (
--   id serial primary key,
--   effective_from date not null,
--   vat numeric(5,4) not null, nhil numeric(5,4) not null,
--   getfund numeric(5,4) not null, covid_levy numeric(5,4) not null default 0,
--   goods_threshold numeric(14,2) not null,
--   note text
-- );
-- ============================================================

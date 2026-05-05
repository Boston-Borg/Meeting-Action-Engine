-- =====================================================================
-- AI Meeting → Action Engine — Postgres schema (Supabase)
-- Paste this entire file into the Supabase SQL editor and run it.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- meetings: one row per uploaded transcript
-- ---------------------------------------------------------------------
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  source        text not null default 'upload',          -- upload | zoom | teams | email
  source_ref    text,                                    -- external id (zoom uuid, etc.)
  transcript    text not null,                           -- raw cleaned transcript
  occurred_at   timestamptz,                             -- when the meeting happened
  processed_at  timestamptz,                             -- when LLM finished
  created_at    timestamptz not null default now()
);

create index if not exists meetings_created_at_idx on public.meetings (created_at desc);

-- ---------------------------------------------------------------------
-- decisions
-- ---------------------------------------------------------------------
create table if not exists public.decisions (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  decision      text not null,
  rationale     text,
  source_quote  text,
  confidence    numeric(3,2) check (confidence between 0 and 1),
  created_at    timestamptz not null default now()
);

create index if not exists decisions_meeting_idx on public.decisions (meeting_id);

-- ---------------------------------------------------------------------
-- action_items — the core accountability table
-- ---------------------------------------------------------------------
do $$ begin
  create type action_status as enum ('pending', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.action_items (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  task          text not null,
  owner         text,                                    -- free-text name; later FK to users
  deadline      date,
  status        action_status not null default 'pending',
  source_quote  text,
  confidence    numeric(3,2) check (confidence between 0 and 1),
  completed_at  timestamptz,
  last_reminded_at timestamptz,
  notion_page_id text,                                   -- mirror in user's Notion DB (nullable)
  created_at    timestamptz not null default now()
);

-- If you've already created the table without the notion_page_id column,
-- run this once to add it. Safe to run repeatedly.
alter table public.action_items
  add column if not exists notion_page_id text;

create index if not exists action_items_meeting_idx on public.action_items (meeting_id);
create index if not exists action_items_status_idx  on public.action_items (status);
create index if not exists action_items_owner_idx   on public.action_items (owner);
create index if not exists action_items_deadline_idx on public.action_items (deadline);

-- Auto-stamp completed_at when status flips to 'completed'
create or replace function public.tg_action_items_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists action_items_completed_at on public.action_items;
create trigger action_items_completed_at
  before update on public.action_items
  for each row execute function public.tg_action_items_completed_at();

-- ---------------------------------------------------------------------
-- open_questions
-- ---------------------------------------------------------------------
create table if not exists public.open_questions (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  question      text not null,
  context       text,
  source_quote  text,
  created_at    timestamptz not null default now()
);

create index if not exists open_questions_meeting_idx on public.open_questions (meeting_id);

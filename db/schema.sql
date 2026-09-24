-- Clinic Growth Agent — run once in the Supabase SQL editor.
-- Tables are prefixed cga_ so they can live beside other tables in the same project.
create table if not exists cga_ads (
  id text primary key, day int not null, name text not null,
  spend numeric default 0, reach int default 0, clicks int default 0
);
create table if not exists cga_people (
  id text primary key, alias text not null,
  real_name_enc text, phone_enc text,
  first_seen_day int not null, ad_id text references cga_ads(id) on delete set null
);
create table if not exists cga_conversations (
  id text primary key, person_id text references cga_people(id) on delete cascade,
  day int not null, source text not null check (source in ('message','comment')),
  text_scrubbed text not null, first_reply_minutes int, analysis jsonb
);
create table if not exists cga_reactions (
  day int not null, post_id text not null, type text not null, count int default 0,
  primary key (day, post_id, type)
);
create table if not exists cga_bookings (
  id text primary key, person_id text references cga_people(id) on delete cascade,
  conversation_id text references cga_conversations(id) on delete cascade,
  day int not null, booking_date text, attended boolean
);
create table if not exists cga_hypotheses (
  id text primary key, stage text not null, statement text not null,
  metric text not null, threshold numeric not null, direction text not null default 'below',
  status text not null default 'testing' check (status in ('testing','confirmed','rejected')),
  evidence jsonb default '[]'::jsonb, created_day int not null, updated_day int not null
);
create table if not exists cga_runs (
  day int primary key, mode text not null, status text not null,
  alert text, error text, summary jsonb, counts jsonb,
  finished_at timestamptz default now()
);
create index if not exists cga_conv_day on cga_conversations(day);
create index if not exists cga_book_day on cga_bookings(day);

-- Server-only access: RLS on with no public policies; the service role bypasses RLS.
do $$ declare t text; begin
  foreach t in array array['cga_ads','cga_people','cga_conversations','cga_reactions','cga_bookings','cga_hypotheses','cga_runs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

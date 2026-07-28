create table if not exists public.student_profiles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.session_events (
  id uuid primary key,
  profile_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null check (event_type = 'session.completed'),
  occurred_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;
alter table public.session_events enable row level security;

create policy "Students own profiles"
on public.student_profiles for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Students own events"
on public.session_events for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists session_events_profile_time
on public.session_events(profile_id, occurred_at desc);

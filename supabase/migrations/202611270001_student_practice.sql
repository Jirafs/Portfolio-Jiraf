begin;

create table public.practice_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.practice_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 100),
  group_name text not null check (char_length(trim(group_name)) between 1 and 40)
);

create table public.practice_completions (
  user_id uuid not null references public.practice_profiles(user_id) on delete cascade,
  task_id text not null check (task_id ~ '^(layout|javascript|xml)-[0-4]$|^(html|react|php)-[1-3]$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.practice_teachers enable row level security;
alter table public.practice_profiles enable row level security;
alter table public.practice_completions enable row level security;

revoke all on public.practice_teachers, public.practice_profiles, public.practice_completions from anon, authenticated;
grant select on public.practice_teachers, public.practice_profiles, public.practice_completions to authenticated;
grant insert (user_id, display_name, group_name) on public.practice_profiles to authenticated;
grant insert (user_id, task_id) on public.practice_completions to authenticated;

create policy "Read own teacher status" on public.practice_teachers for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Read student profile" on public.practice_profiles for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.practice_teachers where user_id = (select auth.uid())
  ));
create policy "Create own profile" on public.practice_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Read student completions" on public.practice_completions for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.practice_teachers where user_id = (select auth.uid())
  ));
create policy "Create own completion" on public.practice_completions for insert to authenticated
  with check (user_id = (select auth.uid()));

commit;

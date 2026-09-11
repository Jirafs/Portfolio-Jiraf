-- ============================================================
--  Схема Supabase для портфолио Jiraf.
--  Выполните этот скрипт в Supabase → SQL Editor (один раз).
-- ============================================================

-- Таблица с метаданными загруженных файлов.
-- Благодаря ей опубликованные файлы видят все посетители сайта.
create table if not exists public.portfolio_files (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('document', 'certificate')),
  file_name    text not null,
  file_size    bigint,
  file_type    text,
  bucket       text not null,
  storage_path text not null,
  public_url   text not null,
  created_at   timestamptz not null default now()
);

create index if not exists portfolio_files_kind_idx on public.portfolio_files (kind, created_at desc);

-- Включаем защиту на уровне строк (RLS).
alter table public.portfolio_files enable row level security;

-- ЧИТАТЬ могут все (посетители видят опубликованные файлы).
drop policy if exists "portfolio_files_read_all" on public.portfolio_files;
create policy "portfolio_files_read_all"
  on public.portfolio_files
  for select
  using (true);

-- ПИСАТЬ и УДАЛЯТЬ может только владелец.
-- Владелец определяется по email из JWT — см. список в supabase-config.js.
-- Замените email ниже на свой, если он другой.
drop policy if exists "portfolio_files_owner_insert" on public.portfolio_files;
create policy "portfolio_files_owner_insert"
  on public.portfolio_files
  for insert
  to authenticated
  with check (auth.jwt() ->> 'email' = 'konkony22@gmail.com');

drop policy if exists "portfolio_files_owner_delete" on public.portfolio_files;
create policy "portfolio_files_owner_delete"
  on public.portfolio_files
  for delete
  to authenticated
  using (auth.jwt() ->> 'email' = 'konkony22@gmail.com');

-- ============================================================
--  Бакеты для файлов.
--  Создаются кодом отдельно, но при необходимости можно и здесь:
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

-- Читать файлы могут все (бакеты публичные).
drop policy if exists "storage_read_all" on storage.objects;
create policy "storage_read_all"
  on storage.objects
  for select
  using (bucket_id in ('documents', 'certificates'));

-- Загружать файлы может только владелец.
drop policy if exists "storage_owner_insert" on storage.objects;
create policy "storage_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('documents', 'certificates')
    and auth.jwt() ->> 'email' = 'konkony22@gmail.com'
  );

-- Удалять файлы может только владелец.
drop policy if exists "storage_owner_delete" on storage.objects;
create policy "storage_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('documents', 'certificates')
    and auth.jwt() ->> 'email' = 'konkony22@gmail.com'
  );

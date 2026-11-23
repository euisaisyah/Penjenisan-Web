-- =====================================================================
-- Penjenisan Kain & Benang: skema database Supabase
-- Jalankan sekali di Supabase > SQL Editor > New query > Run.
-- Aman dijalankan ulang (pakai IF NOT EXISTS / DROP ... IF EXISTS).
-- =====================================================================

-- 1. Master Jenis Benang (dulu sheet MASTER JENIS)
create table if not exists public.master_benang (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  alias text not null default '',
  t1 text not null default '',          -- tambahan 1 (SAMPLE / M71)
  t2 text not null default '',          -- tambahan 2
  fix numeric,                          -- % tetap (spandex), 0.02 = 2%
  ord integer,                          -- urutan (dipakai saat ada alias kembar)
  updated_at timestamptz not null default now(),
  updated_by_email text
);

-- 2. Aturan grouping (selalu 1 baris, id = 1)
create table if not exists public.aturan (
  id integer primary key default 1 check (id = 1),
  warna text[],                         -- null = pakai daftar warna bawaan aplikasi
  matang text[] not null default '{}',
  eksternal text[] not null default '{}',
  double_winder text[] not null default '{}',
  kurung boolean not null default true,
  dw_pola boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_email text
);

-- 3. Database Kain
create table if not exists public.db_kain (
  nama text primary key,                -- nama kain (huruf besar, spasi dirapikan)
  b1 text, p1 numeric, b2 text, p2 numeric, b3 text, p3 numeric,
  grp text,                             -- Greige / Matang
  gm boolean not null default false,    -- grouping diisi manual
  src text,                             -- auto / manual / import
  updated_at timestamptz not null default now(),
  updated_by_email text
);

-- 4. Database Benang
create table if not exists public.db_benang (
  nama text primary key,
  jenis text,
  grp text,                             -- Greige / Warna / Eksternal / Double Winder
  gm boolean not null default false,
  src text,
  updated_at timestamptz not null default now(),
  updated_by_email text
);

-- Catat otomatis kapan & siapa yang mengubah
create or replace function public.pj_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by_email := coalesce(auth.jwt() ->> 'email', new.updated_by_email);
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['master_benang','aturan','db_kain','db_benang'] loop
    execute format('drop trigger if exists pj_stamp on public.%I', t);
    execute format('create trigger pj_stamp before insert or update on public.%I for each row execute function public.pj_stamp()', t);

    -- Keamanan: hanya user yang sudah login yang bisa baca/tulis. Tanpa login = tidak ada data.
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tim baca" on public.%I', t);
    execute format('drop policy if exists "tim tambah" on public.%I', t);
    execute format('drop policy if exists "tim ubah" on public.%I', t);
    execute format('drop policy if exists "tim hapus" on public.%I', t);
    execute format('create policy "tim baca" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "tim tambah" on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy "tim ubah" on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "tim hapus" on public.%I for delete to authenticated using (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Update langsung terlihat di layar semua user (realtime)
do $$
declare t text;
begin
  foreach t in array array['master_benang','aturan','db_kain','db_benang'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Isi awal aturan: daftar Benang Eksternal & Double Winder
insert into public.aturan (id, eksternal, double_winder)
values (1,
  array['YARN; Modal,NE 40 LENZING.CM;MARTIN COTT4060 HOSI.Y2QS140303', 'YARN;COT,NE,40,CM,BCI,COMPACT;INDORAMA.(NAG)I8640-617Q', 'YARN;CVC,60/40,NE,24,M71;INDOLIBERTY,V14A-06B', 'YARN;SPX,Td,22-20 5628 ;LYCRA(NAG),1U072', 'YARN;COT,NE,40,CM ; DELTA MERLIN(NAG)TORAY.015A035Z', 'YARN;CVC,60/40,NE,24,CM;GLOBE.24277-08A', 'YARN;PLY,Td,55T-48,GAHL;TETORON,TORAY.(NAG).AEF17/MOOO/AA', 'YARN;PLY,Td,84T-72,9D24L;TETORON,TORAY.(NAG).R578/MTO/AA', 'YARN;NYLON.40-34.2W9T-CH-A8BOX.02K20LGTW.TORAY.02-A8'],
  array['YARN ;M D W RY,NE 40 + PL 75/36 DD;SUPERBTEX,NL', 'YARN;M D W NE,CD 30 + PL83/36;SUPERBTEX,NL', 'YARN;M D W,NE, CD 30 + PL75/36DD;SUPERBTEX,NL', 'YARN;RYN,NE,40MVS+FILL75/36SD;SUPERBTEX,NL'])
on conflict (id) do nothing;

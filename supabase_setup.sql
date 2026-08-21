-- Çorlu TSO Verimlilik Skoru — Başvuru Tablosu
-- Bu SQL'i Supabase Dashboard > SQL Editor içine yapıştırıp RUN'a basın.

create table if not exists verimlilik_basvurular (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Zorunlu iletişim bilgileri (takip için)
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,

  -- Skorlar
  overall_score numeric not null,
  level_name text not null,
  isgucu_score numeric,
  surec_score numeric,
  uretim_score numeric,
  stok_score numeric,
  enerji_score numeric,
  zaman_score numeric,

  -- Ham cevaplar (ileride yeniden analiz edebilmek için)
  answers jsonb,

  -- KVKK onayı
  kvkk_consent boolean not null default true,
  kvkk_consent_at timestamptz not null default now()
);

-- Row Level Security: herkes INSERT edebilsin, kimse dışarıdan SELECT/UPDATE/DELETE yapamasın.
-- Siz (Oda) verileri Supabase Dashboard'a kendi hesabınızla giriş yaparak göreceksiniz;
-- anon/public anahtarla dışarıdan okuma mümkün OLMAYACAK.
alter table verimlilik_basvurular enable row level security;

create policy "Herkes basvuru ekleyebilir"
  on verimlilik_basvurular
  for insert
  to anon
  with check (true);

-- Not: Bilerek bir SELECT policy eklemedik. Kayıtları sadece
-- Supabase Dashboard > Table Editor üzerinden (kendi giriş bilgilerinizle) göreceksiniz.

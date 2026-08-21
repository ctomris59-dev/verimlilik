# Verimlilik Skoru

TPM/OEE, Lean Altı Sigma, ISO 50001 ve APICS/ASCM çerçevelerine dayanan, KOBİ'ler için
iş gücü, süreç, üretim, stok, enerji ve zaman kayıplarını ölçen verimlilik öz-değerlendirme
aracı. Metodoloji detayları için `METODOLOJI.md` dosyasına bakın.

## Yerelde çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` açılır.

## Production build

```bash
npm run build
```

Çıktı `dist/` klasörüne yazılır — Vercel bu klasörü otomatik tanır.

## Vercel'e deploy

1. Bu klasörü kendi GitHub reponuza (örn. `verimlilik-skoru`) push edin.
2. Vercel'de "New Project" → repoyu seçin.
3. Framework olarak **Vite** otomatik algılanır. Build command: `npm run build`,
   Output directory: `dist`.
4. Environment Variables kısmına `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY`
   değerlerini girin (bkz. `.env.example`).
5. Deploy edin.

## Supabase kurulumu

`supabase_setup.sql` dosyasını Supabase Dashboard > SQL Editor'e yapıştırıp çalıştırın.
Bu, diğer Üye Dönüşüm araçlarınızdan bağımsız yeni bir tablo (`verimlilik_basvurular`)
oluşturur — aynı Supabase projesini paylaşabilir ya da ayrı bir proje kullanabilirsiniz.

## Diğer Üye Dönüşüm araçlarıyla tutarlılık notları

- Mimari (intro → soru akışı → zorunlu iletişim formu → sonuç ekranı → PDF), diğer üç
  araçla (Dijital Olgunluk, Yeşil Dönüşüm, Afet & İş Sürekliliği) birebir aynıdır.
- Gauge ve Radar bileşenleri aynı SVG geometrisini kullanır (`cx=110, cy=120, r=88` yarım
  daire gauge; 6 eksenli radar).
- Tipografi: Space Grotesk (başlıklar/gauge) + Plus Jakarta Sans (gövde) + IBM Plex Mono
  (etiketler) — mevcut üç uygulamanın font dilinin devamı.
- Tasarım vurgu rengi kasıtlı olarak farklıdır: Afet aracı kırmızı (#B91C1C), Yeşil Dönüşüm
  yeşil, bu araç ise amber/bakır (#B45309) — "verimlilik/enerji" temasını yansıtır. Gauge ve
  radar üzerindeki 5 kademeli olgunluk renk skalası (kahverengi→kırmızı→turuncu→amber→teal)
  tüm araçlarda tutarlı tutulmuştur.
- PDF çıktısı jsPDF ile üretilir, `public/ctso-logo.png` ve `public/fonts/DejaVuSans-*`
  dosyaları diğer araçlarla aynı varlıklardır (Türkçe karakter desteği için).
- Ana panel sayfasına (`ikizdonusum.vercel.app` hub) 5. kart olarak eklemek isterseniz:
  accent rengi `#B45309`, etiket `"Verimlilik"` kullanılabilir.

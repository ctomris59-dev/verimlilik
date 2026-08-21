import { createClient } from "@supabase/supabase-js";

// Bu iki değer .env dosyasından gelir (bkz. .env.example).
// Vite'da env değişkenlerinin tarayıcıya geçmesi için VITE_ ön eki zorunludur.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Geliştirme sırasında .env eksikse sessizce yanlış davranmak yerine konsola uyarı basıyoruz.
  console.warn(
    "Supabase bağlantı bilgileri eksik. Proje kökünde bir .env dosyası oluşturup " +
      "VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değerlerini girin (bkz. .env.example)."
  );
}

// Geçersiz/eksik .env durumunda createClient() hemen hata fırlatıp tüm uygulamayı
// çökertmesin diye çalışan bir URL biçimine geri dönüyoruz. Gerçek istekler,
// .env doldurulana kadar zaten formdaki "kaydedilirken sorun oluştu" mesajıyla
// nazikçe başarısız olur (bkz. App.jsx handleContactSubmit).
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

# Verimlilik Skoru — Metodoloji

## Amaç
Bu araç, KOBİ'lerin iş gücü, süreç, üretim, stok, enerji ve zaman boyutlarındaki
operasyonel kayıplarını hızlı bir öz-değerlendirmeyle ölçer ve önceliklendirir.

## Dayandığı çerçeveler

### 1. Toyota Üretim Sistemi — 7 İsraf (Muda) Sınıflandırması
Lean üretimin temel taşı olan israf sınıflandırması (kullanılmayan yetenek, bekleme,
taşıma, fazla işleme, fazla üretim, stok, hareket); "İş Gücü Kayıpları" ve "Süreç
Kayıpları" boyutlarının kavramsal omurgasını oluşturur.

### 2. Lean Altı Sigma — Süreç Döngü Verimliliği (PCE)
Bir sürecin toplam süresinin ne kadarının katma değerli olduğunu ölçen yaklaşım.
"Süreç Kayıpları" boyutundaki onay bekleme, yeniden işleme ve bilgi aktarım
sorularının çerçevesini oluşturur.

### 3. TPM — Toplam Ekipman Etkinliği (OEE, Nakajima)
Kullanılabilirlik × Performans × Kalite formülüyle üretim kayıplarını üç bileşene
ayıran, dünya çapında yaygın kabul gören bakım/üretim metodolojisi. "Üretim
Kayıpları" boyutundaki dört soru (duruş, hız, hurda, bakım stratejisi) doğrudan bu
üç bileşene karşılık gelir.

### 4. APICS/ASCM Tedarik Zinciri KPI Çerçevesi
Uluslararası tedarik zinciri yönetimi kuruluşunun stok devir hızı, stok tükenmesi
(stockout) ve atıl stok gibi göstergeleri kapsayan çerçevesi. "Stok Kayıpları"
boyutunun temelini oluşturur.

### 5. ISO 50001:2018 — Enerji Yönetim Sistemi
Enerji Performans Göstergesi (EnPI) mantığıyla birim üretim başına enerji
tüketimini izlemeyi esas alan uluslararası standart. "Enerji Kayıpları"
boyutundaki tüketim izleme, kaçak tespiti ve ekipman verimliliği sorularının
çerçevesini oluşturur.

### 6. SMED (Shigeo Shingo) & Takt Süresi
Hazırlık/değişim (setup) sürelerini sistematik olarak kısaltan SMED yöntemi ve
talebe göre üretim hızını dengeleyen takt süresi kavramı. "Zaman Kayıpları"
boyutunun temelini oluşturur.

## Puanlama mantığı
- Her soru 1-5 arası, davranışsal olarak tanımlanmış 5 seçenekten oluşur (soyut
  "katılıyorum/katılmıyorum" yerine somut olgunluk ifadeleri tercih edilmiştir).
- Boyut skoru: o boyuttaki 4 sorunun ortalaması, 0-100 skalasına dönüştürülür.
- Genel skor: tüm 24 sorunun ortalaması, 0-100 skalasına dönüştürülür (eşit
  ağırlıklı; hiçbir boyut diğerine göre öncelikli sayılmamıştır).
- 5 olgunluk seviyesi (Dağınık/Kayıp Odaklı → Optimize/Sürekli İyileştirme) skor
  aralıklarına göre atanır.

## Sınırlamalar (önemli)
Bu araç bir **öz-değerlendirmedir**. Bağımsız bir OEE ölçümü, enerji etüdü, stok
sayımı veya süreç zaman etüdünün yerine geçmez. Sonuçlar yalnızca işletmenin kendi
algısına dayalı bir yol haritası niteliğindedir; sayısal doğrulama gerektiren
kararlar (ekipman yatırımı, enerji etüdü, stok politikası değişikliği vb.) için
uzman/danışman desteği alınmalıdır.

## Genişletme önerileri
- Sektöre özel soru varyasyonları eklenebilir (örn. tekstilde iplik/kumaş
  fireleri, gıdada soğuk zincir enerji kaybı).
- Gerçek OEE/EnPI verisi giren işletmeler için sayısal veri girişli "ileri mod"
  eklenebilir (mevcut sürüm tamamen algısal/davranışsal sorulara dayanır).
- Sonuç ekranına, düşük skorlu boyutlar için Çorlu TSO'nun ilgili eğitim/danışmanlık
  hizmetlerine yönlendiren bağlantılar eklenebilir.

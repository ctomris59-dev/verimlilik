import React, { useState, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";
import { generateVerimlilikPdfReport } from "./lib/pdfReport";

/* ======================================================================
   ÇORLU TSO — VERİMLİLİK SKORU (LIGHT EDITORIAL FULLSCREEN)
   Mimari, afet-is-surekliligi ile birebir aynıdır; tema amber/verimlilik,
   içerik ve metodoloji tamamen bu araca özgüdür.
   ====================================================================== */

/* ---------------- Değerlendirme boyutları ---------------- */
const DIMENSIONS = [
  { key: "isgucu", label: "İş Gücü Kayıpları", short: "İş Gücü", ref: "Lean 7 İsraf — Kullanılmayan Yetenek" },
  { key: "surec", label: "Süreç Kayıpları", short: "Süreç", ref: "Lean Altı Sigma — Süreç Döngü Verimliliği (PCE)" },
  { key: "uretim", label: "Üretim Kayıpları", short: "Üretim", ref: "TPM — Toplam Ekipman Etkinliği (OEE)" },
  { key: "stok", label: "Stok Kayıpları", short: "Stok", ref: "APICS/ASCM Tedarik Zinciri KPI Çerçevesi" },
  { key: "enerji", label: "Enerji Kayıpları", short: "Enerji", ref: "ISO 50001 — Enerji Performans Göstergesi (EnPI)" },
  { key: "zaman", label: "Zaman Kayıpları", short: "Zaman", ref: "SMED / Takt Süresi Yönetimi" },
];

/* ---------------- Soru bankası ---------------- */
const QUESTIONS = [
  {
    id: "ig1", dim: "isgucu",
    text: "Devamsızlık, iş kazası veya iş gücü kaybı oranınızı ne ölçüde izliyorsunuz?",
    options: [
      "Hiç izlenmiyor",
      "Genel bir izlenim var, veri tutulmuyor",
      "Aylık olarak kabaca not ediliyor",
      "Düzenli olarak ölçülüyor ve kayıt altına alınıyor",
      "Düzenli izleniyor, hedefle kıyaslanıyor ve iyileştirme aksiyonu üretiliyor",
    ],
  },
  {
    id: "ig2", dim: "isgucu",
    text: "İşletmenizde fazla mesai, yapısal bir ihtiyaç mı yoksa istisna mı?",
    options: [
      "Sürekli ve planlı fazla mesaiye bağımlıyız",
      "Sık sık fazla mesaiye başvuruluyor, nedeni analiz edilmiyor",
      "Bazı dönemlerde (sezon) fazla mesai artıyor, kabaca öngörülüyor",
      "Fazla mesai istisnai, nedenleri kayıt altına alınıyor",
      "Fazla mesai istisnai ve vardiya/kapasite planlamasıyla önceden önleniyor",
    ],
  },
  {
    id: "ig3", dim: "isgucu",
    text: "Çalışanların becerileri ile üstlendikleri görevler ne ölçüde örtüşüyor?",
    options: [
      "Görev dağılımı yalnızca kimin müsait olduğuna göre yapılıyor",
      "Genel bir uyum var ama sistematik değerlendirme yok",
      "Temel yetkinlik-görev eşleşmesi biliniyor",
      "Yetkinlik matrisi var, görevlendirme buna göre yapılıyor",
      "Yetkinlik matrisi düzenli güncelleniyor, çapraz eğitimle esneklik sağlanıyor",
    ],
  },
  {
    id: "ig4", dim: "isgucu",
    text: "Yeni işe başlayan bir çalışan ne kadar sürede tam verimli hale geliyor?",
    options: [
      "Hiç ölçülmüyor / bilinmiyor",
      "Uzun sürdüğü biliniyor ama kısaltmaya yönelik adım yok",
      "Temel bir oryantasyon süreci var",
      "Yapılandırılmış oryantasyon ve mentörlükle süre kısaltılıyor",
      "Süre ölçülüyor, hedefleniyor ve sürekli kısaltılıyor",
    ],
  },
  {
    id: "sr1", dim: "surec",
    text: "Temel iş süreçleriniz (sipariş, üretim, sevkiyat vb.) yazılı olarak tanımlı mı?",
    options: [
      "Hayır, süreçler kişilerin hafızasında",
      "Bazı süreçler yalnızca sözlü olarak biliniyor",
      "Ana süreçlerin bir kısmı yazılı",
      "Tüm ana süreçler yazılı ve paylaşılmış",
      "Süreçler yazılı, versiyonlanıyor ve düzenli gözden geçiriliyor",
    ],
  },
  {
    id: "sr2", dim: "surec",
    text: "Bir işin başlangıcından bitişine kadar, onay bekleme gibi katma değersiz süreler toplam sürenin ne kadarını oluşturuyor?",
    options: [
      "Çoğunluğunu (yarıdan fazlasını)",
      "Önemli bir kısmını, ama hiç ölçülmedi",
      "Orta düzeyde, kabaca biliniyor",
      "Az; süreç adımları sadeleştirilmiş",
      "Çok az; süreç döngü verimliliği düzenli ölçülüyor",
    ],
  },
  {
    id: "sr3", dim: "surec",
    text: "Hatalı iş nedeniyle yeniden yapılan işlerin (rework) oranı nasıl?",
    options: [
      "Yüksek, sık sık yeniden yapılıyor",
      "Belirgin ama ölçülmüyor",
      "Orta düzeyde, bazı kayıtlar tutuluyor",
      "Düşük, düzenli izleniyor",
      "Çok düşük; kök neden analiziyle sürekli azaltılıyor",
    ],
  },
  {
    id: "sr4", dim: "surec",
    text: "Departmanlar arası bilgi/veri aktarımında tekrar veri girişi veya kayıp yaşanıyor mu?",
    options: [
      "Sürekli, her aktarımda yeniden giriliyor",
      "Sık sık yaşanıyor",
      "Bazı noktalarda entegrasyon var",
      "Çoğunlukla entegre, az tekrar var",
      "Tam entegre, tekrar veri girişi yaşanmıyor",
    ],
  },
  {
    id: "ur1", dim: "uretim",
    text: "Ekipman arıza/duruş süreleri planlı üretim süresine kıyasla ne düzeyde?",
    options: [
      "Sık ve öngörülemeyen duruşlar yaşanıyor",
      "Duruşlar var, nedenleri kayıt altına alınmıyor",
      "Duruşlar kayıt altına alınıyor, analiz edilmiyor",
      "Duruşlar analiz ediliyor, azaltma aksiyonları var",
      "Duruş süresi düşük, önleyici bakımla sistematik yönetiliyor",
    ],
  },
  {
    id: "ur2", dim: "uretim",
    text: "Üretim hattı teorik/nominal kapasitesine kıyasla ne hızda çalışıyor?",
    options: [
      "Bilinmiyor / hiç ölçülmedi",
      "Belirgin şekilde yavaş, nedeni net değil",
      "Orta düzeyde, bazı yavaşlama noktaları biliniyor",
      "Nominal kapasiteye yakın, darboğazlar biliniyor",
      "Nominal kapasiteye çok yakın; performans oranı düzenli izleniyor",
    ],
  },
  {
    id: "ur3", dim: "uretim",
    text: "Hurda, ıskarta veya kalite red oranınız nasıl?",
    options: [
      "Yüksek ve izlenmiyor",
      "Yüksek ama not ediliyor",
      "Orta düzeyde, izleniyor",
      "Düşük, düzenli izleniyor",
      "Çok düşük; kök neden analiziyle sürekli azaltılıyor",
    ],
  },
  {
    id: "ur4", dim: "uretim",
    text: "Ekipman bakımı hangi yaklaşımla yürütülüyor?",
    options: [
      "Sadece arıza çıkınca müdahale ediliyor",
      "Bazı ekipmanlarda periyodik bakım var",
      "Kritik ekipmanlarda planlı (önleyici) bakım var",
      "Çoğu ekipmanda planlı bakım ve takip sistemi var",
      "Kestirimci/önleyici bakım (TPM) yaklaşımı tüm kritik ekipmanlarda uygulanıyor",
    ],
  },
  {
    id: "st1", dim: "stok",
    text: "Stok devir hızınız (yılda kaç kez stoğun yenilendiği) sektör ortalamasına göre nasıl?",
    options: [
      "Bilinmiyor / hiç hesaplanmadı",
      "Düşük olduğu biliniyor",
      "Ortalama civarında",
      "Ortalamanın üzerinde, düzenli izleniyor",
      "Yüksek ve hedeflerle sürekli karşılaştırılıyor",
    ],
  },
  {
    id: "st2", dim: "stok",
    text: "Hammadde/ürün stok tükenmesi (stockout) nedeniyle üretim veya satış kaybı ne sıklıkla yaşanıyor?",
    options: [
      "Sık sık yaşanıyor",
      "Zaman zaman yaşanıyor, nedeni analiz edilmiyor",
      "Nadiren yaşanıyor",
      "Çok nadir, güvenlik stoku politikası var",
      "Neredeyse hiç yaşanmıyor; talep tahminiyle önceden yönetiliyor",
    ],
  },
  {
    id: "st3", dim: "stok",
    text: "Atıl veya yavaş hareket eden (satılamayan/kullanılamayan) stok oranınız nasıl?",
    options: [
      "Yüksek, hiç takip edilmiyor",
      "Yüksek olduğu biliniyor",
      "Orta düzeyde, ara sıra gözden geçiriliyor",
      "Düşük, düzenli gözden geçiriliyor",
      "Çok düşük; düzenli stok yaşlandırma analizi yapılıyor",
    ],
  },
  {
    id: "st4", dim: "stok",
    text: "Stok seviyeleri nasıl belirleniyor?",
    options: [
      "Tecrübeye/tahmine dayalı, veri kullanılmıyor",
      "Geçmiş satışlara kabaca bakılıyor",
      "Basit bir talep tahmini yapılıyor",
      "Veriye dayalı talep tahmini ve yeniden sipariş noktası kullanılıyor",
      "Sistematik talep planlama (hareketli ortalama, mevsimsellik) uygulanıyor",
    ],
  },
  {
    id: "en1", dim: "enerji",
    text: "Birim ürün/hizmet başına enerji tüketiminiz izleniyor mu?",
    options: [
      "Hiç izlenmiyor",
      "Sadece toplam fatura takip ediliyor",
      "Bölüm/hat bazında kabaca izleniyor",
      "Birim üretim başına düzenli hesaplanıyor",
      "Enerji performans göstergesi (EnPI) olarak izlenip hedeflere bağlanıyor",
    ],
  },
  {
    id: "en2", dim: "enerji",
    text: "Basınçlı hava, buhar, su veya elektrik kaçakları ne sıklıkla tespit edilip giderilir?",
    options: [
      "Hiç kontrol edilmiyor",
      "Sorun fark edilince bakılıyor",
      "Ara sıra genel kontrol yapılıyor",
      "Periyodik planlı kontrol var",
      "Düzenli taramayla sistematik olarak tespit edilip gideriliyor",
    ],
  },
  {
    id: "en3", dim: "enerji",
    text: "Enerji yoğun ekipman (motor, kompresör, aydınlatma vb.) seçiminde enerji verimlilik sınıfı ne ölçüde gözetiliyor?",
    options: [
      "Hiç gözetilmiyor, sadece fiyat belirleyici",
      "Nadiren dikkate alınıyor",
      "Yeni alımlarda bazen gözetiliyor",
      "Yeni alımlarda standart kriter olarak gözetiliyor",
      "Mevcut park dahil kademeli olarak verimli ekipmana geçiliyor",
    ],
  },
  {
    id: "en4", dim: "enerji",
    text: "Vardiya dışı veya boşta çalışma kaynaklı enerji israfı ne düzeyde kontrol ediliyor?",
    options: [
      "Hiç kontrol edilmiyor, ekipman/ışıklar sürekli açık kalabiliyor",
      "Farkındalık var ama prosedür yok",
      "Bazı alanlarda kapatma prosedürü var",
      "Çoğu alanda standart kapatma/otomasyon var",
      "Tüm alanlarda otomatik kontrol (sensör, zamanlayıcı) uygulanıyor",
    ],
  },
  {
    id: "zm1", dim: "zaman",
    text: "Ürün veya parti değişimi (setup/changeover) süreleri nasıl yönetiliyor?",
    options: [
      "Uzun ve kişiden kişiye değişiyor, standart yok",
      "Standart yok ama tecrübeyle kısaltılmaya çalışılıyor",
      "Temel bir standart prosedür var",
      "Standartlaştırılmış, süre düzenli ölçülüyor",
      "SMED yaklaşımıyla sürekli kısaltılıyor, hedeflerle izleniyor",
    ],
  },
  {
    id: "zm2", dim: "zaman",
    text: "Planlanan teslim süreleri (lead time) ne sıklıkla aşılıyor?",
    options: [
      "Çoğunlukla aşılıyor",
      "Sık sık aşılıyor, nedeni analiz edilmiyor",
      "Bazen aşılıyor",
      "Nadiren aşılıyor, nedenleri izleniyor",
      "Neredeyse hiç aşılmıyor; teslim performansı düzenli raporlanıyor",
    ],
  },
  {
    id: "zm3", dim: "zaman",
    text: "Toplantı ve koordinasyon süreleri alınan kararlarla ne ölçüde orantılı?",
    options: [
      "Toplantılar uzun, çoğu zaman somut karar çıkmıyor",
      "Bazen verimsiz, gündem belirsiz",
      "Genelde gündemli, süre kısmen kontrollü",
      "Gündem ve süre sınırı standart",
      "Kısa, gündemli; karar/aksiyon takibi yapılan toplantılar",
    ],
  },
  {
    id: "zm4", dim: "zaman",
    text: "Çalışanlar günlük işlerinde malzeme/onay/bilgi beklerken ne sıklıkla boşta kalıyor?",
    options: [
      "Sık sık, önemli bir zaman kaybı",
      "Zaman zaman yaşanıyor",
      "Bazı noktalarda yaşanıyor, önlem alınmamış",
      "Nadiren, darboğazlar biliniyor",
      "Neredeyse hiç; iş akışı takt süresine göre dengelenmiş",
    ],
  },
];

/* ---------------- Olgunluk seviyeleri ---------------- */
const LEVELS = [
  { min: 0, max: 20, name: "Dağınık / Kayıp Odaklı", color: "#7C2D12", desc: "Kayıplar sistematik olarak izlenmiyor ve büyük olasılıkla maliyetlerin önemli bir kısmını oluşturuyor. İlk adım, kayıpları görünür kılmak." },
  { min: 21, max: 40, name: "Farkında / Tepkisel", color: "#B91C1C", desc: "Kayıpların varlığı biliniyor ama veri ve sistematik takip eksik; önlemler genellikle sorun çıktıktan sonra alınıyor." },
  { min: 41, max: 60, name: "Gelişmekte / Kısmi Kontrol", color: "#C2410C", desc: "Bazı boyutlarda ölçüm ve kontrol var; sıradaki öncelik, kısmi uygulamaları tüm işletmeye yaymak." },
  { min: 61, max: 80, name: "Yönetilen / Sistematik", color: "#B45309", desc: "Kayıplar çoğunlukla ölçülüyor ve yönetiliyor. İnce ayar ve hedefe dayalı sürekli iyileştirme aşaması." },
  { min: 81, max: 100, name: "Optimize / Sürekli İyileştirme", color: "#0F766E", desc: "Kayıplar minimum düzeyde; ölçüm, hedefleme ve sürekli iyileştirme döngüsü kurumsallaşmış." },
];

const getLevel = (score) => LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[0];

/* ---------------- Senaryo Matrisi ---------------- */
const DIM_SCENARIOS = {
  isgucu: [
    {
      scenario: "İş gücü kayıpları (devamsızlık, fazla mesai, yetkinlik uyumsuzluğu) hiç ölçülmüyor — Lean çerçevesindeki 7 israf sınıflandırmasının 'kullanılmayan yetenek' boyutu görünmez durumda. İlk adım karmaşık bir sistem değil, tek sayfalık bir takip.",
      actions: ["Aylık devamsızlık ve fazla mesai saatini tek bir tabloda kaydetmeye başlayın", "Her çalışan için 1-2 cümlelik bir görev-yetkinlik notu çıkarın", "Bu iki kaydı aylık bir hatırlatmayla takvime ekleyin"],
    },
    {
      scenario: "Kayıpların varlığı biliniyor ama veri tutulmadığı için hangi kaybın öncelikli olduğu net değil. Sıradaki adım, izlenimi sayıya dönüştürmek.",
      actions: ["Son 3 aylık devamsızlık/fazla mesai verisini geriye dönük olarak toparlayın", "Yetkinlik-görev uyumsuzluğu yaşanan 2-3 örneği yazılı hale getirin", "Bulguları kısa bir özet olarak yönetimle paylaşın"],
    },
    {
      scenario: "Temel veriler kabaca tutuluyor; sıradaki adım bunu düzenli bir yetkinlik matrisine ve fazla mesai nedenlerinin analizine bağlamak.",
      actions: ["Basit bir yetkinlik matrisi (çalışan x görev) oluşturun", "Fazla mesainin hangi dönemlerde/nedenle arttığını 2-3 ayrı kategoriye ayırın", "Yeni işe alım sürecine kısa bir oryantasyon kontrol listesi ekleyin"],
    },
    {
      scenario: "Yetkinlik matrisi ve düzenli kayıt var — birçok KOBİ'nin ulaşmadığı bir olgunluk seviyesi. Sıradaki adım, bu veriyi çapraz eğitim ve esnek görevlendirmeye dönüştürmek.",
      actions: ["Kritik görevler için en az bir yedek çalışan belirleyip çapraz eğitim planlayın", "Fazla mesai azaltma hedefini (örn. %X) yönetim gündemine ekleyin", "Oryantasyon süresini ölçüp bir önceki döneme göre kıyaslayın"],
    },
    {
      scenario: "İş gücü kayıpları düzenli izleniyor, hedeflerle kıyaslanıyor ve aksiyon üretiliyor — bu seviyeyi korumak asıl hedef olmalı.",
      actions: ["Yetkinlik matrisini yıllık olarak gözden geçirip güncelleyin", "Fazla mesai ve devamsızlık trendini çeyreklik yönetim raporuna ekleyin", "İyi uygulamaları diğer departmanlara/şubelere yayın"],
    },
  ],
  surec: [
    {
      scenario: "Süreçler kişilerin hafızasında yaşıyor — bu, anahtar bir çalışan ayrıldığında sürecin de kaybolması anlamına gelir. Lean Altı Sigma'nın süreç döngü verimliliği (PCE) mantığı, önce sürecin yazılı bir haritasını çıkarmayı gerektirir.",
      actions: ["En sık tekrarlanan 1-2 süreci (örn. sipariş alma) adım adım yazıya dökün", "Her adımın kim tarafından, ne kadar sürede yapıldığını not edin", "Yazılı süreci ilgili çalışanlarla doğrulayın"],
    },
    {
      scenario: "Bazı süreçler sözlü olarak biliniyor ama hiçbiri yazılı değil — onay bekleme ve tekrar gibi katma değersiz adımlar bu yüzden fark edilmiyor.",
      actions: ["Sözlü bilinen süreçleri kısa maddeler halinde yazıya geçirin", "Her süreçte 'kim onaylıyor, ne kadar bekleniyor' sorusunu yanıtlayın", "En uzun bekleme süresine sahip adımı işaretleyin"],
    },
    {
      scenario: "Ana süreçlerin bir kısmı yazılı — sıradaki adım, süreç döngü verimliliğini kabaca da olsa ölçmek: toplam sürenin ne kadarı katma değerli.",
      actions: ["Bir süreç için başlangıç-bitiş süresini bir kez ölçün", "Bekleme/onay sürelerinin toplam süreye oranını hesaplayın", "En büyük bekleme kaynağını azaltacak tek bir değişikliği deneyin"],
    },
    {
      scenario: "Tüm ana süreçler yazılı ve paylaşılmış — sıradaki adım, süreçleri düzenli gözden geçirme ve hata/tekrar oranını sistematik izlemeye bağlamak.",
      actions: ["Yeniden işleme (rework) oranını aylık olarak kaydetmeye başlayın", "Departmanlar arası veri aktarımındaki tekrarları haritalandırın", "Süreç dokümanlarına bir revizyon tarihi ve sorumlusu ekleyin"],
    },
    {
      scenario: "Süreçler yazılı, versiyonlanıyor ve düzenli gözden geçiriliyor — bu disiplini korumak ve genişletmek önceliğiniz olmalı.",
      actions: ["Süreç döngü verimliliğini yıllık bir KPI olarak izlemeye başlayın", "Departmanlar arası entegrasyonu (tekrar veri girişi sıfır) hedef haline getirin", "İyi uygulanan bir süreci diğer benzer süreçlere şablon yapın"],
    },
  ],
  uretim: [
    {
      scenario: "Ekipman duruşları sık ve öngörülemez — TPM'in Toplam Ekipman Etkinliği (OEE) yaklaşımının ilk bileşeni olan 'kullanılabilirlik' ciddi kayıp yaşıyor. İlk adım, arızaları not almaya başlamak.",
      actions: ["Her arızada tarih, süre ve nedeni not eden basit bir defter/tablo başlatın", "En sık arızalanan 1-2 ekipmanı belirleyin", "Bu ekipmanlar için haftalık görsel kontrol rutini tanımlayın"],
    },
    {
      scenario: "Duruşlar yaşanıyor ama nedenleri kayıt altına alınmıyor — hangi arızanın öncelikli olduğu bilinmiyor.",
      actions: ["Son 1-2 aylık duruşları geriye dönük hatırlayarak listeleyin", "En sık tekrar eden arıza türünü işaretleyin", "Bu arıza türü için basit bir önleyici kontrol adımı tanımlayın"],
    },
    {
      scenario: "Duruşlar kayıt altına alınıyor ama analiz edilmiyor — veri var, aksiyon eksik. Performans (hat hızı) ve kalite (hurda) boyutlarını da bu kayda eklemek OEE'yi tamamlar.",
      actions: ["Duruş kayıtlarını aylık olarak gözden geçirip en büyük 3 nedeni sıralayın", "Hat hızını teorik kapasiteyle bir kez kıyaslayın", "Hurda/ıskarta oranını aynı tabloya ekleyin"],
    },
    {
      scenario: "Duruşlar analiz ediliyor ve azaltma aksiyonları var — sıradaki adım, bunu planlı/önleyici bakım programına dönüştürmek.",
      actions: ["Kritik ekipmanlar için bir önleyici bakım takvimi oluşturun", "OEE'yi (kullanılabilirlik x performans x kalite) tek bir sayı olarak hesaplayın", "Hedef bir OEE değeri belirleyip aylık izleyin"],
    },
    {
      scenario: "Duruş süresi düşük, önleyici bakım sistematik yönetiliyor — TPM olgunluğunda ileri bir seviyedesiniz.",
      actions: ["Önleyici bakımı kestirimci bakıma (titreşim/sıcaklık izleme vb.) doğru genişletmeyi değerlendirin", "OEE trendini yönetim toplantılarının standart gündem maddesi yapın", "Operatörleri temel bakım görevlerine dahil eden bir 'otonom bakım' pilotu başlatın"],
    },
  ],
  stok: [
    {
      scenario: "Stok devir hızı hiç hesaplanmamış — APICS/ASCM'in temel tedarik zinciri KPI setinin başlangıç noktası olan bu gösterge olmadan, atıl stokla düşük stoğu ayırt etmek zor.",
      actions: ["En az bir ürün grubu için basit bir stok devir hızı hesaplayın (yıllık satış / ortalama stok)", "En yavaş hareket eden 5 kalemi listeleyin", "Bu kalemler için bir gözden geçirme tarihi belirleyin"],
    },
    {
      scenario: "Stok devir hızının düşük olduğu biliniyor ama nedenleri analiz edilmemiş — sıradaki adım, düşüklüğün atıl stoktan mı yoksa talep dalgalanmasından mı kaynaklandığını ayırmak.",
      actions: ["Stok tükenmesi (stockout) yaşanan son 2-3 olayı not edin", "Aynı dönemde atıl kalan kalemleri de not edin", "İkisi arasındaki dengeyi kabaca değerlendirin"],
    },
    {
      scenario: "Stok devir hızı ortalama civarında — temel bir talep tahmini eklemek, hem stockout hem atıl stok riskini birlikte azaltabilir.",
      actions: ["Geçmiş 6-12 aylık satış verisine dayalı basit bir talep tahmini oluşturun", "Kritik kalemler için bir yeniden sipariş noktası belirleyin", "Atıl stok kalemlerini üç ayda bir gözden geçirin"],
    },
    {
      scenario: "Stok devir hızı ortalamanın üzerinde ve düzenli izleniyor — sıradaki adım, bunu güvenlik stoku politikası ve düzenli stok yaşlandırma analiziyle pekiştirmek.",
      actions: ["Kritik girdiler için resmi bir güvenlik stoku politikası yazın", "Stok yaşlandırma analizini üç ayda bir düzenli hale getirin", "Talep tahmin doğruluğunu geçmiş dönemle kıyaslayın"],
    },
    {
      scenario: "Stok devir hızı yüksek ve hedeflerle sürekli karşılaştırılıyor — bu disiplini korumak asıl önceliğiniz olmalı.",
      actions: ["Talep planlama yöntemini mevsimsellik gibi ek faktörlerle zenginleştirin", "Kritik tedarikçilerle stok verisi paylaşımını değerlendirin (VMI benzeri yaklaşım)", "Stok KPI'larını tedarik zinciri ortaklarınızla paylaşarak güveni artırın"],
    },
  ],
  enerji: [
    {
      scenario: "Enerji tüketimi hiç izlenmiyor — ISO 50001'in temelini oluşturan Enerji Performans Göstergesi (EnPI) mantığı henüz uygulanmıyor. İlk adım, faturayı değil birim tüketimi görünür kılmak.",
      actions: ["Son 12 aylık elektrik/doğalgaz faturalarını tek bir tabloya toplayın", "Aynı dönemin üretim miktarıyla kabaca oranlayın", "En yüksek tüketimli ekipmanı/alanı belirleyin"],
    },
    {
      scenario: "Sadece toplam fatura takip ediliyor — hangi hat veya ekipmanın enerji yoğun olduğu bilinmiyor.",
      actions: ["Enerji yoğun 2-3 ekipmanı (kompresör, fırın, motor vb.) belirleyin", "Bu ekipmanların çalışma saatlerini kabaca not edin", "Basit bir kaçak taraması (göz/kulakla) yapın"],
    },
    {
      scenario: "Bölüm/hat bazında kabaca izleme var — sıradaki adım, birim üretim başına tüketimi düzenli hesaplamak.",
      actions: ["Birim ürün başına enerji tüketimini aylık hesaplamaya başlayın", "Basınçlı hava/buhar hatlarında periyodik kaçak kontrolü planlayın", "Vardiya dışı kapatma prosedürü olmayan alanları listeleyin"],
    },
    {
      scenario: "Birim üretim başına tüketim düzenli hesaplanıyor — bunu resmi bir EnPI'ye ve hedefe bağlamak ISO 50001 olgunluğuna taşır.",
      actions: ["Birim tüketim için yıllık bir azaltma hedefi belirleyin", "Yeni ekipman alımlarında enerji verimlilik sınıfını standart kritere ekleyin", "Vardiya dışı alanlarda otomatik kapatma (zamanlayıcı/sensör) pilotu başlatın"],
    },
    {
      scenario: "EnPI düzenli izleniyor ve hedeflere bağlanmış — ISO 50001 ruhuna uygun olgun bir yönetim seviyesindesiniz.",
      actions: ["Enerji yönetim sistemini resmi ISO 50001 sertifikasyonuna taşımayı değerlendirin", "Kaçak tarama sonuçlarını yıllık bakım planına entegre edin", "Enerji verimliliği iyi uygulamalarını tedarikçilerinize de önerin"],
    },
  ],
  zaman: [
    {
      scenario: "Değişim (setup) süreleri kişiden kişiye değişiyor ve standart yok — SMED (Shigeo Shingo) yaklaşımının başlangıç noktası, mevcut süreyi bir kez ölçüp adımlara ayırmaktır.",
      actions: ["Bir ürün değişimini baştan sona kronometreleyin", "Adımları 'makine dururken yapılması zorunlu' ve 'önceden hazırlanabilir' olarak ikiye ayırın", "Önceden hazırlanabilir adımları bir kontrol listesine yazın"],
    },
    {
      scenario: "Standart yok ama tecrübeyle kısaltılmaya çalışılıyor — bu bilgi yazılı hale gelmeden bir sonraki değişimde tekrar kaybediliyor.",
      actions: ["En tecrübeli çalışanın değişim adımlarını yazıya dökün", "Teslim süresi aşımı yaşanan son 2-3 siparişi not edin", "Toplantı gündemlerine bir süre sınırı koymayı deneyin"],
    },
    {
      scenario: "Temel bir standart prosedür var — sıradaki adım, süreyi düzenli ölçüp SMED mantığıyla kademeli kısaltmak.",
      actions: ["Değişim süresini her seferinde ölçüp kaydetmeye başlayın", "Teslim süresi performansını (zamanında teslim oranı) aylık izleyin", "Toplantılara yazılı gündem ve süre sınırı standardı getirin"],
    },
    {
      scenario: "Değişim süreleri standartlaştırılmış ve düzenli ölçülüyor — sıradaki adım, bu disiplini takt süresi mantığıyla tüm iş akışına yaymak.",
      actions: ["En uzun süren değişim adımını hedefli olarak kısaltmaya çalışın", "Boşta bekleme yaşanan darboğaz noktalarını haritalandırın", "Teslim süresi hedefini yönetim raporuna ekleyin"],
    },
    {
      scenario: "SMED yaklaşımıyla değişim süreleri sürekli kısaltılıyor ve iş akışı takt süresine göre dengelenmiş — ileri bir zaman yönetimi olgunluğundasınız.",
      actions: ["Değişim süresi iyileştirmelerini diğer hat/ürünlere yayın", "Takt süresi hesaplamasını talep değişikliklerine göre güncel tutun", "Zaman kayıplarına ilişkin iyi uygulamaları çalışan eğitimlerine standart olarak ekleyin"],
    },
  ],
};

function MethodologyModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-[#FAF9F6] border border-slate-900 max-w-xl w-full max-h-[85vh] overflow-y-auto p-8 md:p-12 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-8 pb-4 border-b border-slate-900">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-1">DOKÜMAN #01</span>
            <h3 className="text-xl font-bold tracking-tight uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Metodoloji &amp; Dayanaklar</h3>
          </div>
          <button onClick={onClose} className="font-mono text-xs uppercase text-slate-500 hover:text-slate-900 transition">
            [KAPAT]
          </button>
        </div>
        <div className="space-y-6 text-xs leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 01 GENEL ÇERÇEVE</p>
            <p className="font-bold text-sm text-slate-900 mb-1">Toyota Üretim Sistemi — 7 İsraf (Muda) Sınıflandırması</p>
            <p className="text-slate-600">İş Gücü ve Süreç boyutlarının temelini oluşturan Lean sınıflandırması; kullanılmayan yetenek, bekleme, taşıma, fazla işleme, fazla üretim, stok ve hareket israflarını tanımlar.</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 02 SÜREÇ VERİMLİLİĞİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">Lean Altı Sigma — Süreç Döngü Verimliliği (PCE)</p>
            <p className="text-slate-600">Toplam sürecin ne kadarının katma değerli olduğunu ölçen yaklaşım; Süreç Kayıpları boyutundaki soruların çerçevesini oluşturur.</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 03 EKİPMAN ETKİNLİĞİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">TPM — Toplam Ekipman Etkinliği (OEE, Nakajima)</p>
            <p className="text-slate-600">Kullanılabilirlik × Performans × Kalite formülüyle üretim kayıplarını üç bileşene ayıran, dünya çapında yaygın kabul gören metodoloji.</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 04 TEDARİK ZİNCİRİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">APICS/ASCM Tedarik Zinciri KPI Çerçevesi</p>
            <p className="text-slate-600">Stok devir hızı, stok tükenmesi ve atıl stok gibi göstergeleri kapsayan, uluslararası tedarik zinciri yönetimi kuruluşunun çerçevesi.</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 05 ENERJİ YÖNETİMİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">ISO 50001:2018 — Enerji Yönetim Sistemi</p>
            <p className="text-slate-600">Enerji Performans Göstergesi (EnPI) mantığıyla birim üretim başına tüketimi izlemeyi esas alan uluslararası standart.</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 06 ZAMAN YÖNETİMİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">SMED (Shigeo Shingo) &amp; Takt Süresi</p>
            <p className="text-slate-600">Hazırlık/değişim sürelerini sistematik olarak kısaltan SMED yöntemi ve talebe göre üretim hızını dengeleyen takt süresi kavramı, Zaman Kayıpları boyutunun temelidir.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Gauge (0-100) ---------------- */
function Gauge({ value, color = "#0F172A", maxWidth = 220 }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = 88;
  const startAngle = -180;
  const endAngle = 0;
  const pct = Math.max(0, Math.min(1, value / 100));
  const needleAngle = startAngle + pct * (endAngle - startAngle);

  const polar = (angleDeg, radius) => {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };
  const arcPath = (a0, a1, radius) => {
    const [x0, y0] = polar(a0, radius);
    const [x1, y1] = polar(a1, radius);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
  };
  const [nx, ny] = polar(needleAngle, r - 14);

  return (
    <svg viewBox={`0 0 ${size} ${size * 0.62}`} width="100%" style={{ maxWidth, display: "block", margin: "0 auto" }}>
      <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
      <path d={arcPath(startAngle, needleAngle, r)} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#0F172A" />
      <text x={cx} y={cy - 32} textAnchor="middle" fontSize="30" fontWeight="800" fill="#0F172A" fontFamily="'Space Grotesk', sans-serif">
        {Math.round(value)}
      </text>
    </svg>
  );
}

/* ---------------- Radar (6 boyut, 0-100) ---------------- */
function RadarChart({ byDim, color = "#0F172A", maxWidth = 320 }) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 108;
  const n = DIMENSIONS.length;

  const pointAt = (i, r) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const rings = [20, 40, 60, 80, 100];
  const dataPoints = DIMENSIONS.map((d, i) => pointAt(i, (byDim[d.key] / 100) * maxR));
  const dataPath = dataPoints.map((p) => p.join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth, display: "block", margin: "0 auto" }}>
      {rings.map((ringVal) => {
        const pts = DIMENSIONS.map((_, i) => pointAt(i, (ringVal / 100) * maxR).join(",")).join(" ");
        return (
          <polygon
            key={ringVal}
            points={pts}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={ringVal === 100 ? 1.5 : 1}
            strokeDasharray={ringVal === 100 ? "0" : "3,3"}
          />
        );
      })}
      {DIMENSIONS.map((d, i) => {
        const [x, y] = pointAt(i, maxR);
        return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#CBD5E1" strokeWidth="1" />;
      })}
      <polygon points={dataPath} fill={`${color}26`} stroke={color} strokeWidth="2.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color} stroke="#FFFFFF" strokeWidth="2" />
      ))}
      {DIMENSIONS.map((d, i) => {
        const [x, y] = pointAt(i, maxR + 26);
        return (
          <text
            key={d.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="#334155"
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
          >
            {d.short.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

function KVKKModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-[#FAF9F6] border border-slate-900 max-w-xl w-full max-h-[85vh] overflow-y-auto p-8 md:p-12 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-8 pb-4 border-b border-slate-900">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-1">DOKÜMAN #00</span>
            <h3 className="text-xl font-bold tracking-tight uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              KVKK Aydınlatma Metni
            </h3>
          </div>
          <button onClick={onClose} className="font-mono text-xs uppercase text-slate-500 hover:text-slate-900 transition">
            [KAPAT]
          </button>
        </div>
        <div className="space-y-5 text-xs leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// VERİ SORUMLUSU</p>
            <p className="text-slate-600">
              Bu değerlendirme, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında
              Çorlu Ticaret ve Sanayi Odası ("Oda") tarafından veri sorumlusu sıfatıyla yürütülmektedir.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// İŞLENEN VERİLER</p>
            <p className="text-slate-600">
              Değerlendirmeyi tamamlayıp sonuç raporunu görüntülemeniz için firma unvanı, yetkili
              adı-soyadı, e-posta adresi, telefon numarası ile anket yanıtlarınız ve hesaplanan
              verimlilik skorlarınız işlenir.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// İŞLEME AMACI</p>
            <p className="text-slate-600">
              Verileriniz; işletmenizin verimlilik olgunluk düzeyinin ölçülmesi, size özel sonuç
              raporunun sunulması ve Oda tarafından ilerleyen dönemde tarafınızla iletişime geçilerek
              gelişim sürecinizin takip edilmesi amacıyla işlenir.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// HUKUKİ SEBEP</p>
            <p className="text-slate-600">
              KVKK md. 5/1 uyarınca açık rızanıza dayanılarak; Oda'nın üyelerine yönelik verimlilik
              geliştirme faaliyetlerinin yürütülmesi meşru amacıyla işlenir.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// SAKLAMA VE GÜVENLİK</p>
            <p className="text-slate-600">
              Veriler, yalnızca Oda yetkilileri tarafından erişilebilen güvenli bir veritabanında
              saklanır ve amaç için gerekli süre boyunca tutulur; üçüncü taraflarla paylaşılmaz veya
              ticari amaçla kullanılmaz.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-amber-700 uppercase font-bold mb-0.5">// HAKLARINIZ</p>
            <p className="text-slate-600">
              KVKK md. 11 uyarınca verilerinize erişme, düzeltilmesini/silinmesini talep etme ve rızanızı
              geri alma dahil haklarınızı kullanmak için Oda'ya yazılı olarak başvurabilirsiniz.
            </p>
          </div>
          <p className="text-slate-400 text-[10px] italic">
            Bu metin genel bir taslaktır; yayına almadan önce Oda'nın hukuk/uyum birimince
            gözden geçirilmesi önerilir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState("intro");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showMethodology, setShowMethodology] = useState(false);
  const [showKVKK, setShowKVKK] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);

  // Zorunlu iletişim bilgileri (sonuç/PDF görülmeden önce alınır)
  const [contact, setContact] = useState({ companyName: "", contactName: "", email: "", phone: "" });
  const [contactErrors, setContactErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [pdfState, setPdfState] = useState("idle");

  const currentQ = QUESTIONS[qIndex];

  const handleAnswer = (value) => {
    const next = { ...answers, [currentQ.id]: value };
    setAnswers(next);
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      // Anket bitti — sonuçlar/PDF'ten önce zorunlu iletişim ekranına geç
      setStep("contact");
    }
  };

  const { overall, byDim } = useMemo(() => {
    const dimScores = {};
    DIMENSIONS.forEach((d) => {
      const qs = QUESTIONS.filter((q) => q.dim === d.key);
      const vals = qs.map((q) => answers[q.id]).filter(Boolean);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      dimScores[d.key] = ((avg - 1) / 4) * 100;
    });
    const allVals = Object.values(answers);
    const overallAvg = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0;
    return { overall: ((overallAvg - 1) / 4) * 100, byDim: dimScores };
  }, [answers]);

  const level = getLevel(overall);
  const weakestDims = [...DIMENSIONS]
    .sort((a, b) => byDim[a.key] - byDim[b.key])
    .slice(0, 3)
    .map((d) => {
      const dLevel = getLevel(byDim[d.key]);
      const levelIndex = LEVELS.indexOf(dLevel);
      return { ...d, dLevel, levelIndex, scenario: DIM_SCENARIOS[d.key][levelIndex] };
    });

  const handleDownloadPdf = async () => {
    setPdfState("generating");
    try {
      await generateVerimlilikPdfReport({
        companyName: contact.companyName,
        contactName: contact.contactName,
        dimensions: DIMENSIONS,
        overall,
        byDim,
        level,
        weakestDims,
      });
      setPdfState("idle");
    } catch (e) {
      console.error("PDF üretim hatası:", e);
      setPdfState("error");
    }
  };

  const restart = () => {
    setAnswers({});
    setQIndex(0);
    setStep("intro");
    setKvkkAccepted(false);
    setContact({ companyName: "", contactName: "", email: "", phone: "" });
    setContactErrors({});
    setSubmitError("");
  };

  const handleContactChange = (field) => (e) => {
    setContact({ ...contact, [field]: e.target.value });
    if (contactErrors[field]) setContactErrors({ ...contactErrors, [field]: null });
  };

  const validateContact = () => {
    const errs = {};
    if (!contact.companyName.trim()) errs.companyName = "Firma adı zorunludur";
    if (!contact.contactName.trim()) errs.contactName = "Ad soyad zorunludur";
    if (!contact.email.trim()) errs.email = "E-posta zorunludur";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) errs.email = "Geçerli bir e-posta girin";
    if (!contact.phone.trim()) errs.phone = "Telefon zorunludur";
    else if (contact.phone.replace(/\D/g, "").length < 10) errs.phone = "Geçerli bir telefon girin";
    setContactErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!validateContact()) return;

    setSubmitting(true);
    setSubmitError("");

    const { error } = await supabase.from("verimlilik_basvurular").insert({
      company_name: contact.companyName.trim(),
      contact_name: contact.contactName.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
      overall_score: overall,
      level_name: level.name,
      isgucu_score: byDim.isgucu,
      surec_score: byDim.surec,
      uretim_score: byDim.uretim,
      stok_score: byDim.stok,
      enerji_score: byDim.enerji,
      zaman_score: byDim.zaman,
      answers,
      kvkk_consent: true,
    });

    setSubmitting(false);

    if (error) {
      console.error("Supabase kayıt hatası:", error);
      setSubmitError("Kaydınız gönderilirken bir sorun oluştu. Lütfen tekrar deneyin.");
      return;
    }

    setStep("results");
  };

  const isCenteredScreen = step === "intro" || step === "quiz";

  return (
    <div className="h-screen w-screen bg-[#FAF9F6] text-slate-900 flex flex-col justify-between overflow-hidden relative" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Font Injections */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');
      `}</style>

      {/* Açık Renk Mimari Duvar Kağıdı Deseni */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FAF9F6] via-[#F5F3EF] to-[#EFECE6] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%3C%23000000%3E'/%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      {/* Header */}
      <header className="border-b border-slate-900/10 px-8 py-5 flex-shrink-0 relative z-10 bg-[#FAF9F6]/80 backdrop-blur-md print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-700 font-bold block">KURUMSAL SKORKART</span>
            <h1 className="font-bold text-base md:text-lg tracking-tight text-slate-900 uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Çorlu Ticaret ve Sanayi Odası
            </h1>
          </div>
          <button
            onClick={() => setShowMethodology(true)}
            className="font-mono text-[11px] uppercase tracking-widest border border-slate-900 rounded-none px-4 py-2 hover:bg-slate-900 hover:text-white transition duration-200 text-slate-800"
          >
            METODOLOJİ
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className={`max-w-5xl mx-auto px-6 py-4 flex-1 w-full relative z-10 min-h-0 overflow-y-auto ${
        isCenteredScreen ? "flex items-center justify-center" : ""
      }`}>
        <div className={`w-full ${step === "results" ? "h-full" : ""}`}>

          {/* ---------------- INTRO ---------------- */}
          {step === "intro" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
              <div className="md:col-span-8">
                <span className="font-mono text-[11px] uppercase tracking-widest text-amber-700 block mb-3 font-bold">
                  [ TPM/OEE · LEAN ALTI SİGMA · ISO 50001 · APICS/ASCM · SMED ]
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 uppercase leading-none mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  İşletmeniz kayıplarının ne kadarının farkında?
                </h2>
                <p className="text-slate-600 text-sm md:text-base font-normal max-w-xl leading-relaxed">
                  24 soruluk bu editoryal öz-değerlendirme; iş gücü, süreç, üretim, stok, enerji ve
                  zaman boyutlarındaki verimlilik kayıplarınızı ölçer ve önceliklendirir.
                </p>
              </div>

              <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-900/10 pt-6 md:pt-0 md:pl-8 flex flex-col justify-between">
                <div className="space-y-2 font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-6">
                  {DIMENSIONS.map((d, i) => (
                    <div key={d.key} className="flex justify-between border-b border-slate-900/10 pb-1.5">
                      <span>0{i + 1}. {d.short}</span>
                      <span className="text-slate-900 font-bold">✓</span>
                    </div>
                  ))}
                </div>

                <label className="flex items-start gap-2.5 mb-4 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={kvkkAccepted}
                    onChange={(e) => setKvkkAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-slate-900 flex-shrink-0 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-600 leading-snug">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowKVKK(true); }}
                      className="underline font-bold text-slate-900 hover:text-amber-700"
                    >
                      KVKK Aydınlatma Metni
                    </button>
                    'ni okudum, kişisel verilerimin belirtilen amaçlarla işlenmesini onaylıyorum.
                  </span>
                </label>

                <button
                  onClick={() => kvkkAccepted && setStep("quiz")}
                  disabled={!kvkkAccepted}
                  className={`w-full font-mono text-xs uppercase tracking-widest py-4 px-6 transition duration-300 text-center font-bold ${
                    kvkkAccepted
                      ? "bg-slate-900 hover:bg-amber-800 text-white cursor-pointer"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  DEĞERLENDİRMEYİ BAŞLAT →
                </button>
              </div>
            </div>
          )}

          {/* ---------------- QUIZ (Kaydırmasız Tek Sayfa Düzeni) ---------------- */}
          {step === "quiz" && currentQ && (
            <div className="max-w-3xl mx-auto flex flex-col justify-between h-auto">
              <div>
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-900/10 pb-2">
                  <span className="text-amber-700 font-bold">// BOYUT: {DIMENSIONS.find((d) => d.key === currentQ.dim)?.label.toUpperCase()}</span>
                  <span>SORU {qIndex + 1} / {QUESTIONS.length}</span>
                </div>

                <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase leading-snug mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {currentQ.text}
                </h2>

                <div className="space-y-2.5">
                  {currentQ.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i + 1)}
                      className="w-full text-left p-4 bg-white/80 border border-slate-900/15 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition duration-150 flex items-center gap-4 group"
                    >
                      <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400 group-hover:text-amber-400 font-bold">
                        [0{i + 1}]
                      </span>
                      <span className="text-xs md:text-sm font-medium tracking-tight">
                        {opt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {qIndex > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setQIndex(qIndex - 1)}
                    className="font-mono text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-900 transition"
                  >
                    ← ÖNCEKİ SORUYA DÖN
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------------- CONTACT (Sonuç/PDF öncesi zorunlu) ---------------- */}
          {step === "contact" && (
            <div className="max-w-2xl mx-auto">
              <div className="border-b border-slate-900/10 pb-4 mb-6">
                <span className="font-mono text-[11px] uppercase tracking-widest text-amber-700 block mb-1 font-bold">// SON ADIM</span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 uppercase leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Sonucunuzu görmek için bilgilerinizi girin
                </h2>
                <p className="text-slate-600 text-xs md:text-sm mt-2 leading-relaxed">
                  Değerlendirme sonucunuz ve PDF raporunuz, aşağıdaki bilgiler kaydedildikten sonra
                  görüntülenecektir. Bu bilgiler yalnızca Çorlu TSO tarafından ilerleyen süreçte
                  gelişiminizi takip etmek amacıyla kullanılacaktır.
                </p>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5">Firma Adı *</label>
                  <input
                    type="text"
                    value={contact.companyName}
                    onChange={handleContactChange("companyName")}
                    className={`w-full p-3.5 bg-white/80 border text-sm focus:outline-none focus:border-slate-900 ${contactErrors.companyName ? "border-red-600" : "border-slate-900/15"}`}
                    placeholder="Örn. ABC Tekstil San. ve Tic. A.Ş."
                  />
                  {contactErrors.companyName && <p className="text-red-700 text-[11px] mt-1">{contactErrors.companyName}</p>}
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5">Ad Soyad *</label>
                  <input
                    type="text"
                    value={contact.contactName}
                    onChange={handleContactChange("contactName")}
                    className={`w-full p-3.5 bg-white/80 border text-sm focus:outline-none focus:border-slate-900 ${contactErrors.contactName ? "border-red-600" : "border-slate-900/15"}`}
                    placeholder="Yetkili adı soyadı"
                  />
                  {contactErrors.contactName && <p className="text-red-700 text-[11px] mt-1">{contactErrors.contactName}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5">E-posta *</label>
                    <input
                      type="email"
                      value={contact.email}
                      onChange={handleContactChange("email")}
                      className={`w-full p-3.5 bg-white/80 border text-sm focus:outline-none focus:border-slate-900 ${contactErrors.email ? "border-red-600" : "border-slate-900/15"}`}
                      placeholder="ornek@firma.com"
                    />
                    {contactErrors.email && <p className="text-red-700 text-[11px] mt-1">{contactErrors.email}</p>}
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5">Telefon *</label>
                    <input
                      type="tel"
                      value={contact.phone}
                      onChange={handleContactChange("phone")}
                      className={`w-full p-3.5 bg-white/80 border text-sm focus:outline-none focus:border-slate-900 ${contactErrors.phone ? "border-red-600" : "border-slate-900/15"}`}
                      placeholder="05XX XXX XX XX"
                    />
                    {contactErrors.phone && <p className="text-red-700 text-[11px] mt-1">{contactErrors.phone}</p>}
                  </div>
                </div>

                {submitError && (
                  <p className="text-red-700 text-xs bg-red-50 border border-red-200 p-3">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full font-mono text-xs uppercase tracking-widest py-4 px-6 transition duration-300 text-center font-bold ${
                    submitting ? "bg-slate-300 text-slate-500 cursor-wait" : "bg-slate-900 hover:bg-amber-800 text-white"
                  }`}
                >
                  {submitting ? "KAYDEDİLİYOR..." : "SONUCUMU GÖRÜNTÜLE →"}
                </button>
              </form>
            </div>
          )}

          {/* ---------------- RESULTS ---------------- */}
          {step === "results" && (
            <div className="max-w-6xl mx-auto h-full flex flex-col">
              <div className="border-b border-slate-900/10 pb-2.5 mb-3 flex-shrink-0">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-amber-700 block mb-0.5 font-bold">// NİHAİ DEĞERLENDİRME</span>
                    <h2 className="text-xl md:text-2xl font-extrabold tracking-tight uppercase text-slate-900 leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {level.name}
                    </h2>
                  </div>
                  <div className="font-mono text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
                    {Math.round(overall)}<span className="text-xs text-slate-400">/100</span>
                  </div>
                </div>
                <p className="text-slate-600 text-xs mt-1.5 leading-snug">
                  {level.desc}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0">
                {/* SOL: Gauge + Radar + Boyut Skorları */}
                <div className="md:col-span-5 bg-white border border-slate-900/10 p-3 flex flex-col min-h-0">
                  <div className="grid grid-cols-2 gap-2 flex-shrink-0 border-b border-slate-900/10 pb-2 mb-2">
                    <div className="text-center">
                      <Gauge value={overall} color={level.color} maxWidth={170} />
                      <div className="font-mono text-[8px] uppercase tracking-widest text-slate-400 mt-0.5">GENEL SKOR</div>
                    </div>
                    <RadarChart byDim={byDim} color={level.color} maxWidth={190} />
                  </div>
                  <div className="space-y-2.5 overflow-y-auto min-h-0 flex-1 flex flex-col justify-center">
                    {DIMENSIONS.map((d) => (
                      <div key={d.key}>
                        <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-0.5">
                          <span className="font-bold text-slate-900">{d.short}</span>
                          <span className="text-slate-500">%{Math.round(byDim[d.key])}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1 rounded-none overflow-hidden">
                          <div className="bg-slate-900 h-1 transition-all duration-1000" style={{ width: `${byDim[d.key]}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SAĞ: Öncelikli Aksiyonlar */}
                <div className="md:col-span-7 bg-white border border-slate-900/10 p-3 flex flex-col min-h-0">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2 flex-shrink-0">// ÖNCELİKLİ AKSİYONLAR VE SENARYO</h3>
                  <div className="space-y-2.5 overflow-y-auto min-h-0">
                    {weakestDims.map((d) => (
                      <div key={d.key} className="border-l-2 border-slate-900 pl-2.5 py-0.5">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-amber-700 font-bold">{d.label}</span>
                          <span className="font-mono text-[8px] uppercase px-1.5 py-0.5 bg-slate-200 text-slate-800 font-bold">
                            {d.dLevel.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug mb-1">{d.scenario.scenario}</p>
                        <ul className="space-y-0.5">
                          {d.scenario.actions.map((act, i) => (
                            <li key={i} className="text-[10.5px] text-slate-700 flex gap-1.5 leading-snug">
                              <span className="font-mono text-slate-400 font-bold">0{i + 1}.</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:hidden flex-shrink-0 mt-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfState === "generating"}
                  className="bg-slate-900 hover:bg-amber-800 disabled:opacity-60 text-white font-mono text-xs uppercase tracking-widest py-3 px-6 transition duration-200 font-bold"
                >
                  {pdfState === "generating" ? "RAPOR HAZIRLANIYOR..." : "PDF RAPORU İNDİR →"}
                </button>
                <button
                  onClick={restart}
                  className="border border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 font-mono text-xs uppercase tracking-widest py-3 px-6 transition duration-200 font-bold"
                >
                  YENİDEN BAŞLAT
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/10 px-8 py-3 font-mono text-[10px] uppercase tracking-widest text-slate-500 flex justify-between items-center flex-shrink-0 relative z-10 bg-[#FAF9F6]/80 backdrop-blur-md print:hidden">
        <span>ÇORLU TSO © 2026</span>
        <span>VERİMLİLİK SKORU</span>
      </footer>

      {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
      {showKVKK && <KVKKModal onClose={() => setShowKVKK(false)} />}
    </div>
  );
}

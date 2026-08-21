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
            <span className="font-semibold text-[10px] uppercase tracking-widest text-slate-500 block mb-1">DOKÜMAN #01</span>
            <h3 className="text-xl font-bold tracking-tight uppercase" style={{ fontFamily: "'Manrope', sans-serif" }}>Metodoloji &amp; Dayanaklar</h3>
          </div>
          <button onClick={onClose} className="font-semibold text-xs uppercase text-slate-500 hover:text-slate-900 transition">
            [KAPAT]
          </button>
        </div>
        <div className="space-y-6 text-xs leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 01 GENEL ÇERÇEVE</p>
            <p className="font-bold text-sm text-slate-900 mb-1">Toyota Üretim Sistemi — 7 İsraf (Muda) Sınıflandırması</p>
            <p className="text-slate-600">İş Gücü ve Süreç boyutlarının temelini oluşturan Lean sınıflandırması; kullanılmayan yetenek, bekleme, taşıma, fazla işleme, fazla üretim, stok ve hareket israflarını tanımlar.</p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 02 SÜREÇ VERİMLİLİĞİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">Lean Altı Sigma — Süreç Döngü Verimliliği (PCE)</p>
            <p className="text-slate-600">Toplam sürecin ne kadarının katma değerli olduğunu ölçen yaklaşım; Süreç Kayıpları boyutundaki soruların çerçevesini oluşturur.</p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 03 EKİPMAN ETKİNLİĞİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">TPM — Toplam Ekipman Etkinliği (OEE, Nakajima)</p>
            <p className="text-slate-600">Kullanılabilirlik × Performans × Kalite formülüyle üretim kayıplarını üç bileşene ayıran, dünya çapında yaygın kabul gören metodoloji.</p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 04 TEDARİK ZİNCİRİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">APICS/ASCM Tedarik Zinciri KPI Çerçevesi</p>
            <p className="text-slate-600">Stok devir hızı, stok tükenmesi ve atıl stok gibi göstergeleri kapsayan, uluslararası tedarik zinciri yönetimi kuruluşunun çerçevesi.</p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 05 ENERJİ YÖNETİMİ</p>
            <p className="font-bold text-sm text-slate-900 mb-1">ISO 50001:2018 — Enerji Yönetim Sistemi</p>
            <p className="text-slate-600">Enerji Performans Göstergesi (EnPI) mantığıyla birim üretim başına tüketimi izlemeyi esas alan uluslararası standart.</p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// 06 ZAMAN YÖNETİMİ</p>
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
      <text x={cx} y={cy - 32} textAnchor="middle" fontSize="30" fontWeight="800" fill="#0F172A" fontFamily="'Manrope', sans-serif">
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
            <span className="font-semibold text-[10px] uppercase tracking-widest text-slate-500 block mb-1">DOKÜMAN #00</span>
            <h3 className="text-xl font-bold tracking-tight uppercase" style={{ fontFamily: "'Manrope', sans-serif" }}>
              KVKK Aydınlatma Metni
            </h3>
          </div>
          <button onClick={onClose} className="font-semibold text-xs uppercase text-slate-500 hover:text-slate-900 transition">
            [KAPAT]
          </button>
        </div>
        <div className="space-y-5 text-xs leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// VERİ SORUMLUSU</p>
            <p className="text-slate-600">
              Bu değerlendirme, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında
              Çorlu Ticaret ve Sanayi Odası ("Oda") tarafından veri sorumlusu sıfatıyla yürütülmektedir.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// İŞLENEN VERİLER</p>
            <p className="text-slate-600">
              Değerlendirmeyi tamamlayıp sonuç raporunu görüntülemeniz için firma unvanı, yetkili
              adı-soyadı, e-posta adresi, telefon numarası ile anket yanıtlarınız ve hesaplanan
              verimlilik skorlarınız işlenir.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// İŞLEME AMACI</p>
            <p className="text-slate-600">
              Verileriniz; işletmenizin verimlilik olgunluk düzeyinin ölçülmesi, size özel sonuç
              raporunun sunulması ve Oda tarafından ilerleyen dönemde tarafınızla iletişime geçilerek
              gelişim sürecinizin takip edilmesi amacıyla işlenir.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// HUKUKİ SEBEP</p>
            <p className="text-slate-600">
              KVKK md. 5/1 uyarınca açık rızanıza dayanılarak; Oda'nın üyelerine yönelik verimlilik
              geliştirme faaliyetlerinin yürütülmesi meşru amacıyla işlenir.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// SAKLAMA VE GÜVENLİK</p>
            <p className="text-slate-600">
              Veriler, yalnızca Oda yetkilileri tarafından erişilebilen güvenli bir veritabanında
              saklanır ve amaç için gerekli süre boyunca tutulur; üçüncü taraflarla paylaşılmaz veya
              ticari amaçla kullanılmaz.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[10px] text-amber-700 uppercase font-bold mb-0.5">// HAKLARINIZ</p>
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
    <div
      className="min-h-screen w-full bg-[#F4F7FB] text-[#0B234A] flex flex-col relative overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        * { box-sizing: border-box; }
        html { background: #f4f7fb; }
        body { margin: 0; background: #f4f7fb; }
        ::selection { background: #F2B90A; color: #071A3C; }
        .productivity-scroll::-webkit-scrollbar { width: 7px; }
        .productivity-scroll::-webkit-scrollbar-track { background: rgba(11,35,74,.06); }
        .productivity-scroll::-webkit-scrollbar-thumb { background: rgba(11,35,74,.24); border-radius: 99px; }
        .soft-grid {
          background-image:
            linear-gradient(rgba(11,35,74,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(11,35,74,.035) 1px, transparent 1px);
          background-size: 34px 34px;
        }
      `}</style>

      {/* Industrial / efficiency background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.10]"
          style={{ backgroundImage: "url('/verimlilik-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,247,251,.76)_0%,rgba(244,247,251,.92)_34%,#F4F7FB_72%)]" />
        <div className="absolute inset-0 soft-grid opacity-40" />
        <div className="absolute -top-40 -right-40 w-[620px] h-[620px] rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute top-[32%] -left-52 w-[520px] h-[520px] rounded-full bg-cyan-300/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-30 bg-[#06193A]/[0.98] border-b border-[#E5AE14]/80 shadow-[0_10px_30px_rgba(6,25,58,.16)] print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[92px] flex items-center justify-between gap-5">
          <div className="flex items-center min-w-0 gap-4 sm:gap-5">
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-full border border-[#E5AE14]/35" />
              <img
                src="/ctso-logo.png"
                alt="Çorlu Ticaret ve Sanayi Odası"
                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full object-contain bg-white p-0.5 shadow-[0_0_0_2px_rgba(229,174,20,.8)]"
              />
            </div>
            <div className="h-14 w-px bg-white/25 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#F2B90A] text-[11px] sm:text-sm font-extrabold uppercase tracking-[0.055em]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Çorlu Ticaret ve Sanayi Odası
                </span>
                <span className="hidden md:inline w-1.5 h-1.5 rounded-full bg-white/45" />
                <span className="hidden md:inline text-white/60 text-[10px] font-bold uppercase tracking-[0.16em]">
                  Dijital Dönüşüm Portalı
                </span>
              </div>
              <h1 className="text-white text-lg sm:text-[25px] font-extrabold tracking-[-0.035em] leading-tight mt-0.5 truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Verimlilik Ölçüm Aracı
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {step !== "intro" && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.05] text-white/75 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#F2B90A]" />
                {step === "quiz" ? `Soru ${qIndex + 1}/${QUESTIONS.length}` : step === "contact" ? "Son Adım" : "Sonuç Raporu"}
              </div>
            )}
            <button
              onClick={() => setShowMethodology(true)}
              className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] text-white px-3 sm:px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-all duration-200"
            >
              <svg className="w-4 h-4 text-[#F2B90A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3.5 4.5 7v5c0 4.7 2.8 7.7 7.5 9 4.7-1.3 7.5-4.3 7.5-9V7L12 3.5Z" />
                <path d="m9.2 12 1.8 1.8 4-4" />
              </svg>
              <span className="hidden sm:inline">Metodoloji</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">

          {/* ---------------- INTRO ---------------- */}
          {step === "intro" && (
            <div className="space-y-6 lg:space-y-8">
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
                <div className="lg:col-span-7 relative overflow-hidden rounded-[26px] min-h-[520px] lg:min-h-[570px] shadow-[0_24px_70px_rgba(6,25,58,.17)] border border-white/60">
                  <div
                    className="absolute inset-0 bg-cover bg-center scale-[1.02]"
                    style={{ backgroundImage: "url('/verimlilik-bg.jpg')" }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,20,49,.96)_0%,rgba(4,20,49,.86)_45%,rgba(4,20,49,.35)_78%,rgba(4,20,49,.22)_100%)]" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,20,49,.15)_0%,rgba(4,20,49,.15)_56%,rgba(4,20,49,.72)_100%)]" />

                  <div className="relative h-full p-6 sm:p-9 lg:p-11 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#F2B90A]/45 bg-[#F2B90A]/10 px-3.5 py-2 text-[#FFD96A] text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F2B90A]" />
                        Verimlilik · Rekabet · Sürdürülebilirlik
                      </div>

                      <h2 className="mt-6 max-w-[670px] text-white text-[38px] sm:text-[52px] lg:text-[58px] leading-[1.02] font-extrabold tracking-[-0.05em]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Verimliliğinizi ölçün. Kayıpları görün. Daha güçlü büyüyün.
                      </h2>
                      <p className="mt-5 max-w-[610px] text-white/78 text-sm sm:text-[16px] leading-7 font-medium">
                        İş gücünden süreçlere, üretimden enerji ve zamana kadar işletmenizin görünmeyen
                        kayıplarını 24 soruda analiz edin; geliştirme önceliklerinizi netleştirin.
                      </p>
                    </div>

                    <div className="mt-10">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 max-w-2xl">
                        {[
                          ["01", "Veriye Dayalı Ölçüm"],
                          ["02", "Karşılaştırmalı Analiz"],
                          ["03", "Uygulanabilir Aksiyon"],
                        ].map(([n, text]) => (
                          <div key={n} className="rounded-2xl border border-white/14 bg-white/[0.075] backdrop-blur-md px-4 py-3.5 flex items-center gap-3">
                            <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F2B90A]/15 border border-[#F2B90A]/30 text-[#FFD458] text-xs font-extrabold">
                              {n}
                            </span>
                            <span className="text-white/88 text-[12px] font-semibold leading-snug">{text}</span>
                          </div>
                        ))}
                      </div>

                      <label className="flex items-start gap-3 max-w-2xl cursor-pointer rounded-2xl border border-white/10 bg-black/10 backdrop-blur-sm p-3.5 mb-4">
                        <input
                          type="checkbox"
                          checked={kvkkAccepted}
                          onChange={(e) => setKvkkAccepted(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-[#F2B90A] flex-shrink-0 cursor-pointer"
                        />
                        <span className="text-[11px] sm:text-xs text-white/70 leading-relaxed">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setShowKVKK(true); }}
                            className="text-white font-bold underline decoration-[#F2B90A] underline-offset-2 hover:text-[#FFD458]"
                          >
                            KVKK Aydınlatma Metni
                          </button>
                          'ni okudum, kişisel verilerimin belirtilen amaçlarla işlenmesini onaylıyorum.
                        </span>
                      </label>

                      <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                        <button
                          onClick={() => kvkkAccepted && setStep("quiz")}
                          disabled={!kvkkAccepted}
                          className={`min-h-[52px] flex-1 rounded-xl px-6 font-extrabold text-sm transition-all duration-200 flex items-center justify-center gap-3 shadow-lg ${
                            kvkkAccepted
                              ? "bg-[#F2B90A] hover:bg-[#FFD04A] text-[#071A3C] shadow-[#F2B90A]/15 hover:-translate-y-0.5"
                              : "bg-white/15 text-white/45 cursor-not-allowed shadow-none"
                          }`}
                        >
                          Değerlendirmeye Başla
                          <span className="text-xl leading-none">→</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowMethodology(true)}
                          className="min-h-[52px] rounded-xl px-5 border border-white/20 bg-white/[0.08] hover:bg-white/[0.14] text-white text-sm font-bold transition-all"
                        >
                          Nasıl Çalışır?
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-[26px] bg-[#071D43]/[0.97] text-white p-6 sm:p-7 lg:p-8 shadow-[0_24px_70px_rgba(6,25,58,.18)] border border-[#27456F] relative overflow-hidden">
                  <div className="absolute -right-28 -top-24 w-72 h-72 rounded-full border border-[#F2B90A]/10" />
                  <div className="absolute -right-16 -top-14 w-52 h-52 rounded-full border border-[#F2B90A]/10" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-4 mb-7">
                      <div>
                        <span className="text-[#F2B90A] text-[10px] font-extrabold uppercase tracking-[0.16em]">Ölçüm Çerçevesi</span>
                        <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          6 boyutta bütünsel analiz
                        </h3>
                      </div>
                      <div className="rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-2 text-right">
                        <div className="text-2xl font-extrabold text-[#F2B90A] leading-none">24</div>
                        <div className="text-[9px] text-white/55 uppercase tracking-[0.12em] mt-1">Soru</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {DIMENSIONS.map((d, i) => (
                        <div key={d.key} className="group rounded-2xl border border-white/10 bg-white/[0.055] hover:bg-white/[0.09] hover:border-[#F2B90A]/30 p-4 transition-all duration-200">
                          <div className="flex items-center justify-between mb-5">
                            <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#F2B90A]/10 border border-[#F2B90A]/25 text-[#F2B90A] text-xs font-extrabold">
                              0{i + 1}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-white/35 font-bold">4 soru</span>
                          </div>
                          <div className="text-sm font-bold text-white/92">{d.short}</div>
                          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#F2B90A]/60 to-[#F2B90A]" style={{ width: `${42 + i * 7}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 rounded-2xl border border-[#F2B90A]/20 bg-[#F2B90A]/[0.075] p-4">
                      <div className="flex gap-3 items-start">
                        <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-[#F2B90A] text-[#071A3C] flex items-center justify-center font-black">↗</div>
                        <div>
                          <div className="text-sm font-bold">Sonuçta ne alacaksınız?</div>
                          <p className="mt-1 text-[11px] leading-relaxed text-white/62">
                            Genel skor, boyut bazlı performans, en zayıf üç alan ve doğrudan uygulanabilir iyileştirme önerileri.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  ["6", "Analiz Boyutu", "İşletmenin temel kayıp alanları"],
                  ["24", "Kritik Soru", "Hızlı ama kapsamlı değerlendirme"],
                  ["100", "Puanlık Skor", "Karşılaştırılabilir performans yapısı"],
                  ["3", "Öncelikli Alan", "İlk odaklanmanız gereken konular"],
                ].map(([v, label, desc]) => (
                  <div key={label} className="rounded-2xl bg-white/90 backdrop-blur border border-[#DCE4EF] p-4 sm:p-5 shadow-[0_10px_30px_rgba(11,35,74,.05)]">
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#0B234A] tracking-[-0.04em]" style={{ fontFamily: "'Manrope', sans-serif" }}>{v}</div>
                    <div className="text-xs sm:text-sm font-bold text-[#0B234A] mt-1">{label}</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 leading-relaxed">{desc}</div>
                  </div>
                ))}
              </section>
            </div>
          )}

          {/* ---------------- QUIZ ---------------- */}
          {step === "quiz" && currentQ && (
            <section className="max-w-6xl mx-auto">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[#B98300] text-[10px] font-extrabold uppercase tracking-[0.16em]">Verimlilik Değerlendirmesi</span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B234A] tracking-[-0.035em] mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    İşletmenizin mevcut durumunu puanlayın
                  </h2>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-extrabold text-[#0B234A]">{qIndex + 1}<span className="text-slate-400 font-semibold"> / {QUESTIONS.length}</span></div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-[0.1em] mt-0.5">Soru</div>
                </div>
              </div>

              <div className="h-2 rounded-full bg-white border border-[#DDE5EF] overflow-hidden shadow-inner mb-5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D89A00] via-[#F2B90A] to-[#FFD458] transition-all duration-500"
                  style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <aside className="lg:col-span-4 xl:col-span-3 rounded-[24px] bg-[#071D43] text-white p-5 sm:p-6 shadow-[0_18px_50px_rgba(6,25,58,.14)] h-fit">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45 mb-4">Değerlendirme Boyutları</div>
                  <div className="space-y-2">
                    {DIMENSIONS.map((d, i) => {
                      const dimQuestions = QUESTIONS.filter((q) => q.dim === d.key);
                      const answeredCount = dimQuestions.filter((q) => answers[q.id]).length;
                      const active = currentQ.dim === d.key;
                      const complete = answeredCount === dimQuestions.length;
                      return (
                        <div key={d.key} className={`rounded-xl px-3 py-3 flex items-center gap-3 border transition-all ${active ? "bg-[#F2B90A] border-[#F2B90A] text-[#071A3C]" : "bg-white/[0.04] border-white/[0.07] text-white/75"}`}>
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${active ? "bg-[#071A3C]/10" : "bg-white/[0.06]"}`}>
                            {complete ? "✓" : `0${i + 1}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{d.short}</div>
                            <div className={`text-[9px] mt-0.5 ${active ? "text-[#071A3C]/60" : "text-white/35"}`}>{answeredCount}/4 yanıt</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <div className="lg:col-span-8 xl:col-span-9 rounded-[24px] bg-white/95 backdrop-blur border border-[#DCE4EF] shadow-[0_18px_50px_rgba(11,35,74,.08)] p-5 sm:p-7 lg:p-9">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF6D7] text-[#9B6C00] border border-[#F2D77F] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E2A600]" />
                      {DIMENSIONS.find((d) => d.key === currentQ.dim)?.label}
                    </span>
                    <span className="hidden sm:inline text-[10px] text-slate-400 font-semibold uppercase tracking-[0.1em]">En uygun seçeneği işaretleyin</span>
                  </div>

                  <h3 className="text-[22px] sm:text-[28px] lg:text-[30px] leading-[1.22] font-extrabold text-[#0B234A] tracking-[-0.035em] max-w-4xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {currentQ.text}
                  </h3>

                  <div className="mt-7 space-y-3">
                    {currentQ.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i + 1)}
                        className="w-full text-left rounded-2xl border border-[#DDE5EF] bg-[#FBFCFE] hover:bg-[#071D43] hover:border-[#071D43] hover:text-white p-4 sm:p-4.5 transition-all duration-200 flex items-center gap-4 group hover:-translate-y-[1px] hover:shadow-[0_10px_25px_rgba(6,25,58,.10)]"
                      >
                        <span className="w-10 h-10 flex-shrink-0 rounded-xl border border-[#D8E1EC] bg-white text-[#0B234A] group-hover:border-[#F2B90A] group-hover:bg-[#F2B90A] flex items-center justify-center text-xs font-extrabold transition-colors">
                          {i + 1}
                        </span>
                        <span className="text-sm sm:text-[15px] font-semibold leading-relaxed text-slate-700 group-hover:text-white transition-colors">
                          {opt}
                        </span>
                        <span className="ml-auto text-slate-300 group-hover:text-[#F2B90A] text-xl transition-colors">→</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 pt-5 border-t border-[#E6EBF2] flex items-center justify-between gap-4">
                    {qIndex > 0 ? (
                      <button
                        onClick={() => setQIndex(qIndex - 1)}
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#0B234A] transition-colors"
                      >
                        ← Önceki soruya dön
                      </button>
                    ) : <span />}
                    <span className="text-[10px] text-slate-400 text-right">Yanıtınız otomatik olarak kaydedilir.</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ---------------- CONTACT ---------------- */}
          {step === "contact" && (
            <section className="max-w-4xl mx-auto">
              <div className="rounded-[26px] overflow-hidden border border-[#DCE4EF] bg-white/95 backdrop-blur shadow-[0_24px_70px_rgba(11,35,74,.10)]">
                <div className="bg-[#071D43] p-6 sm:p-8 text-white relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-72 h-72 rounded-full border border-[#F2B90A]/10 translate-x-1/3 -translate-y-1/3" />
                  <div className="relative flex items-start gap-4">
                    <div className="w-12 h-12 flex-shrink-0 rounded-2xl bg-[#F2B90A] text-[#071A3C] flex items-center justify-center font-black text-xl">✓</div>
                    <div>
                      <span className="text-[#F2B90A] text-[10px] font-extrabold uppercase tracking-[0.16em]">Değerlendirme Tamamlandı</span>
                      <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-[-0.04em]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Sonuç raporunuzu hazırlıyoruz
                      </h2>
                      <p className="mt-2 text-white/65 text-xs sm:text-sm leading-relaxed max-w-2xl">
                        Sonucunuzu ve PDF raporunuzu görüntülemek için aşağıdaki iletişim bilgilerini tamamlayın.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleContactSubmit} className="p-6 sm:p-8 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold text-[#0B234A] block mb-2">Firma Adı *</label>
                      <input
                        type="text"
                        value={contact.companyName}
                        onChange={handleContactChange("companyName")}
                        className={`w-full rounded-xl px-4 py-3.5 bg-[#F8FAFD] border text-sm outline-none transition focus:bg-white focus:ring-4 focus:ring-[#F2B90A]/10 ${contactErrors.companyName ? "border-red-500" : "border-[#D8E1EC] focus:border-[#D6A20A]"}`}
                        placeholder="Örn. ABC Tekstil San. ve Tic. A.Ş."
                      />
                      {contactErrors.companyName && <p className="text-red-600 text-[11px] mt-1.5">{contactErrors.companyName}</p>}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#0B234A] block mb-2">Ad Soyad *</label>
                      <input
                        type="text"
                        value={contact.contactName}
                        onChange={handleContactChange("contactName")}
                        className={`w-full rounded-xl px-4 py-3.5 bg-[#F8FAFD] border text-sm outline-none transition focus:bg-white focus:ring-4 focus:ring-[#F2B90A]/10 ${contactErrors.contactName ? "border-red-500" : "border-[#D8E1EC] focus:border-[#D6A20A]"}`}
                        placeholder="Yetkili adı soyadı"
                      />
                      {contactErrors.contactName && <p className="text-red-600 text-[11px] mt-1.5">{contactErrors.contactName}</p>}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#0B234A] block mb-2">Telefon *</label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={handleContactChange("phone")}
                        className={`w-full rounded-xl px-4 py-3.5 bg-[#F8FAFD] border text-sm outline-none transition focus:bg-white focus:ring-4 focus:ring-[#F2B90A]/10 ${contactErrors.phone ? "border-red-500" : "border-[#D8E1EC] focus:border-[#D6A20A]"}`}
                        placeholder="05XX XXX XX XX"
                      />
                      {contactErrors.phone && <p className="text-red-600 text-[11px] mt-1.5">{contactErrors.phone}</p>}
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold text-[#0B234A] block mb-2">E-posta *</label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={handleContactChange("email")}
                        className={`w-full rounded-xl px-4 py-3.5 bg-[#F8FAFD] border text-sm outline-none transition focus:bg-white focus:ring-4 focus:ring-[#F2B90A]/10 ${contactErrors.email ? "border-red-500" : "border-[#D8E1EC] focus:border-[#D6A20A]"}`}
                        placeholder="ornek@firma.com"
                      />
                      {contactErrors.email && <p className="text-red-600 text-[11px] mt-1.5">{contactErrors.email}</p>}
                    </div>
                  </div>

                  {submitError && (
                    <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-xl p-3.5">{submitError}</p>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <div className="text-[10px] text-slate-400 leading-relaxed flex-1">
                      Bilgileriniz yalnızca Çorlu TSO tarafından değerlendirme ve gelişim takibi amacıyla kullanılacaktır.
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`w-full sm:w-auto min-w-[230px] rounded-xl py-3.5 px-6 text-sm font-extrabold transition-all duration-200 ${
                        submitting ? "bg-slate-200 text-slate-500 cursor-wait" : "bg-[#F2B90A] hover:bg-[#FFD04A] text-[#071A3C] hover:-translate-y-0.5 shadow-[0_10px_22px_rgba(242,185,10,.22)]"
                      }`}
                    >
                      {submitting ? "Kaydediliyor..." : "Sonucumu Görüntüle →"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* ---------------- RESULTS ---------------- */}
          {step === "results" && (
            <section className="max-w-7xl mx-auto space-y-5">
              <div className="rounded-[26px] bg-[#071D43] text-white p-6 sm:p-8 shadow-[0_24px_70px_rgba(6,25,58,.16)] relative overflow-hidden">
                <div className="absolute -right-28 -top-28 w-80 h-80 rounded-full border border-[#F2B90A]/10" />
                <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full border border-[#F2B90A]/10" />
                <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                  <div>
                    <span className="text-[#F2B90A] text-[10px] font-extrabold uppercase tracking-[0.16em]">Nihai Verimlilik Değerlendirmesi</span>
                    <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-[-0.045em]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {level.name}
                    </h2>
                    <p className="mt-2 text-white/65 text-xs sm:text-sm leading-relaxed max-w-3xl">{level.desc}</p>
                  </div>
                  <div className="flex items-end gap-3 flex-shrink-0">
                    <div className="text-5xl sm:text-6xl font-extrabold tracking-[-0.06em] leading-none text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {Math.round(overall)}
                    </div>
                    <div className="pb-1.5">
                      <div className="text-sm text-white/45 font-semibold">/100</div>
                      <div className="text-[10px] text-[#F2B90A] font-bold uppercase tracking-[0.1em] mt-1">Genel Skor</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="rounded-[24px] bg-white border border-[#DCE4EF] p-5 sm:p-6 shadow-[0_14px_40px_rgba(11,35,74,.06)]">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-extrabold text-[#0B234A]">Genel Verimlilik Skoru</h3>
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: level.color, backgroundColor: `${level.color}14` }}>{level.name}</span>
                      </div>
                      <Gauge value={overall} color={level.color} maxWidth={250} />
                    </div>

                    <div className="rounded-[24px] bg-white border border-[#DCE4EF] p-5 sm:p-6 shadow-[0_14px_40px_rgba(11,35,74,.06)]">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-extrabold text-[#0B234A]">Boyut Haritası</h3>
                        <span className="text-[10px] font-semibold text-slate-400">6 boyut</span>
                      </div>
                      <RadarChart byDim={byDim} color={level.color} maxWidth={260} />
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-white border border-[#DCE4EF] p-5 sm:p-6 shadow-[0_14px_40px_rgba(11,35,74,.06)]">
                    <div className="flex items-center justify-between gap-4 mb-5">
                      <div>
                        <span className="text-[#B98300] text-[9px] font-extrabold uppercase tracking-[0.14em]">Performans Profili</span>
                        <h3 className="text-lg font-extrabold text-[#0B234A] mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Boyut Bazlı Skorlar</h3>
                      </div>
                      <span className="text-[10px] text-slate-400">0–100 ölçeği</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-4">
                      {DIMENSIONS.map((d, i) => {
                        const score = Math.round(byDim[d.key]);
                        const scoreLevel = getLevel(byDim[d.key]);
                        return (
                          <div key={d.key} className="rounded-2xl bg-[#F8FAFD] border border-[#E5EAF1] p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0B234A] text-white text-[10px] font-extrabold">0{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-[#0B234A] truncate">{d.label}</div>
                                <div className="text-[9px] text-slate-400 mt-0.5 truncate">{d.ref}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-extrabold text-[#0B234A] leading-none">{score}<span className="text-[9px] text-slate-400 font-semibold">/100</span></div>
                                <div className="text-[8px] font-bold mt-1" style={{ color: scoreLevel.color }}>{scoreLevel.name.split(" /")[0]}</div>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-[#E6EBF2] overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${byDim[d.key]}%`, backgroundColor: scoreLevel.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-5 rounded-[24px] bg-[#071D43] text-white p-5 sm:p-6 shadow-[0_18px_50px_rgba(6,25,58,.14)] flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <span className="text-[#F2B90A] text-[9px] font-extrabold uppercase tracking-[0.14em]">İyileştirme Rotası</span>
                      <h3 className="text-xl font-extrabold mt-1 tracking-[-0.035em]" style={{ fontFamily: "'Manrope', sans-serif" }}>Öncelikli 3 aksiyon alanı</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#F2B90A]/10 border border-[#F2B90A]/20 text-[#F2B90A] flex items-center justify-center text-lg">↗</div>
                  </div>

                  <div className="space-y-3 flex-1 productivity-scroll overflow-y-auto pr-1 max-h-[650px]">
                    {weakestDims.map((d, idx) => (
                      <div key={d.key} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 sm:p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[#F2B90A] text-[#071A3C] text-sm font-extrabold">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold">{d.label}</div>
                            <div className="text-[9px] text-[#F2B90A] mt-0.5 uppercase tracking-[0.08em] font-semibold">{d.dLevel.name}</div>
                          </div>
                        </div>
                        <p className="text-[11px] sm:text-xs text-white/62 leading-relaxed mb-3">{d.scenario.scenario}</p>
                        <ul className="space-y-2.5">
                          {d.scenario.actions.map((act, i) => (
                            <li key={i} className="flex gap-2.5 text-[11px] text-white/80 leading-relaxed">
                              <span className="mt-0.5 w-5 h-5 rounded-md bg-white/[0.07] text-[#F2B90A] flex-shrink-0 flex items-center justify-center text-[9px] font-extrabold">{i + 1}</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfState === "generating"}
                  className="rounded-xl bg-[#F2B90A] hover:bg-[#FFD04A] disabled:opacity-60 text-[#071A3C] font-extrabold text-sm py-3.5 px-6 transition-all shadow-[0_10px_22px_rgba(242,185,10,.17)]"
                >
                  {pdfState === "generating" ? "Rapor hazırlanıyor..." : "PDF Raporunu İndir →"}
                </button>
                <button
                  onClick={restart}
                  className="rounded-xl border border-[#C9D4E2] bg-white hover:bg-[#071D43] hover:border-[#071D43] hover:text-white text-[#0B234A] font-extrabold text-sm py-3.5 px-6 transition-all"
                >
                  Yeni Değerlendirme Başlat
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="relative z-20 bg-white/78 backdrop-blur-xl border-t border-[#DDE5EF] print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400 font-semibold">
          <span>© 2026 Çorlu Ticaret ve Sanayi Odası</span>
          <span className="uppercase tracking-[0.12em]">Dijital Dönüşüm Portalı · Verimlilik Ölçüm Aracı</span>
        </div>
      </footer>

      {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
      {showKVKK && <KVKKModal onClose={() => setShowKVKK(false)} />}
    </div>
  );
}

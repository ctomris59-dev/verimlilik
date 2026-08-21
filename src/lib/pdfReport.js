import jsPDF from "jspdf";

/* ---------------------------------------------------------------
   FONT VE LOGO YÜKLEME (Türkçe karakter desteği için DejaVuSans)
--------------------------------------------------------------- */
let fontsLoadedPromise = null;

async function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadLogoBase64() {
  try {
    const response = await fetch("/ctso-logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

async function ensureFontsLoaded(doc) {
  if (!fontsLoadedPromise) {
    fontsLoadedPromise = Promise.all([
      fetch("/fonts/DejaVuSans-subset.ttf").then((r) => r.arrayBuffer()),
      fetch("/fonts/DejaVuSans-Bold-subset.ttf").then((r) => r.arrayBuffer()),
    ]).then(([regularBuf, boldBuf]) =>
      Promise.all([arrayBufferToBase64(regularBuf), arrayBufferToBase64(boldBuf)])
    );
  }
  const [regularB64, boldB64] = await fontsLoadedPromise;
  doc.addFileToVFS("DejaVuSans.ttf", regularB64);
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", boldB64);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
}

/* ---------------------------------------------------------------
   RENK PALETİ (verimlilik-skoru editorial slate/amber teması)
--------------------------------------------------------------- */
const INK = [15, 23, 42];        // slate-900
const AMBER = [180, 83, 9];      // amber-700
const STEEL = [100, 116, 139];   // slate-500
const GRID = [226, 232, 240];    // slate-200
const LIGHT_BG = [248, 250, 252];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

/* ---------------------------------------------------------------
   HEADER / FOOTER
--------------------------------------------------------------- */
function drawHeaderBanner(doc, logoBase64) {
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 20, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 20, PAGE_W, 1, "F");

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", MARGIN, 3, 14, 14);
    } catch (e) {
      /* logo yerleşmezse sessizce geç */
    }
  }
  const titleX = logoBase64 ? MARGIN + 18 : MARGIN;
  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(217, 119, 6);
  doc.text("ÇORLU TİCARET VE SANAYİ ODASI", titleX, 9);
  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Verimlilik Skoru Raporu", titleX, 15);
}

function footer(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...STEEL);
    doc.text("ÇORLU TİCARET VE SANAYİ ODASI · VERİMLİLİK SKORU", MARGIN, PAGE_H - 7);
    doc.text(`Sayfa ${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
  }
}

function paragraph(doc, text, y, opts = {}) {
  const { size = 8.5, color = [51, 65, 85], lineHeight = 4.2, width = CONTENT_W, x = MARGIN } = opts;
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, width);
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

/* ---------------------------------------------------------------
   RADAR GRAFİĞİ (6 boyut, 0-100)
--------------------------------------------------------------- */
function drawRadar(doc, dimensions, byDim, cx, cy, maxR, colorRgb) {
  const n = dimensions.length;
  const pointAt = (i, r) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  [20, 40, 60, 80, 100].forEach((ring) => {
    doc.setDrawColor(...GRID);
    doc.setLineWidth(ring === 100 ? 0.3 : 0.15);
    const pts = dimensions.map((_, i) => pointAt(i, (ring / 100) * maxR));
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % n];
      doc.line(x1, y1, x2, y2);
    }
  });

  dimensions.forEach((_, i) => {
    const [x, y] = pointAt(i, maxR);
    doc.line(cx, cy, x, y);
  });

  const dataPts = dimensions.map((d, i) => pointAt(i, (byDim[d.key] / 100) * maxR));
  doc.setDrawColor(...colorRgb);
  doc.setLineWidth(1);
  for (let i = 0; i < n; i++) {
    const [x1, y1] = dataPts[i];
    const [x2, y2] = dataPts[(i + 1) % n];
    doc.line(x1, y1, x2, y2);
  }
  dataPts.forEach(([x, y]) => {
    doc.setFillColor(...colorRgb);
    doc.circle(x, y, 1.4, "F");
  });

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  dimensions.forEach((d, i) => {
    const [x, y] = pointAt(i, maxR + 8);
    doc.text(d.short.toUpperCase(), x, y, { align: "center" });
  });
}

/* ---------------------------------------------------------------
   GAUGE (yarım daire ibre, 0-100)
--------------------------------------------------------------- */
function drawGauge(doc, value, cx, cy, r, colorRgb) {
  const startAngle = 180;
  const endAngle = 360;
  const pct = Math.max(0, Math.min(1, value / 100));
  const needleAngle = startAngle + pct * (endAngle - startAngle);
  const polar = (angleDeg, radius) => {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };
  const steps = 40;
  doc.setDrawColor(...GRID);
  doc.setLineWidth(3.2);
  for (let i = 0; i < steps; i++) {
    const a0 = startAngle + (i / steps) * (endAngle - startAngle);
    const a1 = startAngle + ((i + 1) / steps) * (endAngle - startAngle);
    const [x0, y0] = polar(a0, r);
    const [x1, y1] = polar(a1, r);
    doc.line(x0, y0, x1, y1);
  }
  const filledSteps = Math.round(steps * pct);
  doc.setDrawColor(...colorRgb);
  for (let i = 0; i < filledSteps; i++) {
    const a0 = startAngle + (i / steps) * (endAngle - startAngle);
    const a1 = startAngle + ((i + 1) / steps) * (endAngle - startAngle);
    const [x0, y0] = polar(a0, r);
    const [x1, y1] = polar(a1, r);
    doc.line(x0, y0, x1, y1);
  }
  const [nx, ny] = polar(needleAngle, r - 4);
  doc.setDrawColor(...INK);
  doc.setLineWidth(1);
  doc.line(cx, cy, nx, ny);
  doc.setFillColor(...INK);
  doc.circle(cx, cy, 1.6, "F");

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(`${Math.round(value)}`, cx, cy - 10, { align: "center" });
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...STEEL);
  doc.text("/ 100", cx, cy - 5, { align: "center" });
}

/* ---------------------------------------------------------------
   ANA RAPOR ÜRETİCİ
--------------------------------------------------------------- */
export async function generateVerimlilikPdfReport({
  companyName,
  contactName,
  dimensions,
  overall,
  byDim,
  level,
  weakestDims,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await ensureFontsLoaded(doc);
  const logo = await loadLogoBase64();
  const levelColor = hexToRgb(level.color || "#0F172A");

  /* ================= SAYFA 1: KAPAK + GAUGE + RADAR ================= */
  drawHeaderBanner(doc, logo);
  let y = 28;

  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...STEEL);
  const dateStr = new Date().toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`Rapor Tarihi: ${dateStr}`, MARGIN, y);
  if (companyName) doc.text(`Firma: ${companyName}`, PAGE_W - MARGIN, y, { align: "right" });
  y += 8;

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  doc.text(level.name, MARGIN, y + 4);
  y += 10;

  y = paragraph(doc, level.desc, y, { size: 9, color: [51, 65, 85] });
  y += 8;

  // Gauge (sol) + Radar (sağ)
  drawGauge(doc, overall, MARGIN + 42, y + 40, 32, levelColor);
  drawRadar(doc, dimensions, byDim, MARGIN + 128, y + 40, 34, levelColor);
  y += 90;

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Boyut Bazlı Skorlar", MARGIN, y);
  y += 6;

  dimensions.forEach((d) => {
    const s = byDim[d.key];
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(d.label, MARGIN, y);
    doc.setTextColor(...AMBER);
    doc.text(`%${Math.round(s)}`, PAGE_W - MARGIN, y, { align: "right" });
    y += 2.5;
    doc.setFillColor(...GRID);
    doc.roundedRect(MARGIN, y, CONTENT_W, 2.4, 1, 1, "F");
    doc.setFillColor(...INK);
    doc.roundedRect(MARGIN, y, (CONTENT_W * s) / 100, 2.4, 1, 1, "F");
    y += 6.5;
  });

  /* ================= SAYFA 2: ÖNCELİKLİ AKSİYONLAR ================= */
  doc.addPage();
  drawHeaderBanner(doc, logo);
  y = 28;

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Öncelikli Aksiyon Alanları ve Senaryo Analizi", MARGIN, y);
  y += 3;
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...STEEL);
  doc.text("En düşük puanlı 3 boyut için somut senaryo ve önerilen aksiyonlar.", MARGIN, y + 4);
  y += 12;

  weakestDims.forEach((d) => {
    const scenarioLines = doc.splitTextToSize(d.scenario.scenario, CONTENT_W - 10);
    const actionLines = d.scenario.actions.map((a, i) => doc.splitTextToSize(`0${i + 1}. ${a}`, CONTENT_W - 14));
    const actionsH = actionLines.reduce((sum, l) => sum + l.length * 3.6, 0);
    const cardH = 14 + scenarioLines.length * 3.8 + 4 + actionsH + 6;

    if (y + cardH > PAGE_H - 20) {
      doc.addPage();
      drawHeaderBanner(doc, logo);
      y = 28;
    }

    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...GRID);
    doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, "FD");
    doc.setFillColor(...AMBER);
    doc.rect(MARGIN, y, 2.5, cardH, "F");

    let iy = y + 6;
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...AMBER);
    doc.text(`${d.label}  ·  ${d.dLevel.name}  ·  %${Math.round(byDim[d.key])}`, MARGIN + 6, iy);
    iy += 5.5;

    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(scenarioLines, MARGIN + 6, iy);
    iy += scenarioLines.length * 3.8 + 3;

    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...INK);
    actionLines.forEach((lines) => {
      doc.text(lines, MARGIN + 6, iy);
      iy += lines.length * 3.6;
    });

    y += cardH + 6;
  });

  y += 4;
  if (y > PAGE_H - 40) {
    doc.addPage();
    drawHeaderBanner(doc, logo);
    y = 28;
  }

  doc.setFillColor(...INK);
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2, 2, "F");
  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(9);
  doc.setTextColor(217, 119, 6);
  doc.text("ÇORLU TSO PROJE SERVİSİ İLE İLETİŞİME GEÇİN", MARGIN + 5, y + 6);
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  const calloutLines = doc.splitTextToSize(
    "Bu rapor sonuçlarınızı detaylandırmak ve verimlilik iyileştirme yol haritanızı birlikte oluşturmak için Odamız uzmanlarıyla iletişime geçebilirsiniz.",
    CONTENT_W - 10
  );
  doc.text(calloutLines, MARGIN + 5, y + 11.5);

  y += 28;
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...STEEL);
  const disclaimer =
    "Bu araç bir öz-değerlendirme ve yönlendirme aracıdır; resmi denetim, sertifikasyon veya danışmanlık hizmetinin yerine geçmez. " +
    "Telif Hakkı © Çorlu Ticaret ve Sanayi Odası.";
  const discLines = doc.splitTextToSize(disclaimer, CONTENT_W);
  doc.text(discLines, MARGIN, y);

  footer(doc);

  const safeName = (companyName || "firma").replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\- ]/g, "").trim() || "firma";
  doc.save(`corlu-tso-verimlilik-skoru-${safeName}.pdf`);
}

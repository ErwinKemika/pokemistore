import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import signatureUrl from "@/assets/signature.png";

const SIGNER_NAME = "Hilmi Atsauri";

let _sigDataUrl: string | null = null;
async function loadSignature(): Promise<string> {
  if (_sigDataUrl) return _sigDataUrl;
  const res = await fetch(signatureUrl);
  const blob = await res.blob();
  _sigDataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  return _sigDataUrl;
}

export type PoHeader = {
  no_po: string;
  tgl_po: string;
  catatan: string | null;
  subtotal: number;
  ppn: number;
  grand_total: number;
};

export type PoItem = {
  no_item: number;
  kode: string;
  nama_produk: string;
  kemasan: string | null;
  qty: number;
  harga: number;
  disc_percent: number;
  disc_rp: number;
  subtotal: number;
};

const BRAND = {
  name: "KEMIKA",
  tagline: "ONLINE STORE",
  legal: "PT. Kemika Karya Pratama",
  store: "Kemika Online Store",
};

// Colors
const GREEN: [number, number, number] = [2, 132, 76];
const ORANGE: [number, number, number] = [217, 119, 6];
const BLACK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [120, 120, 120];
const SOFT_BG: [number, number, number] = [245, 245, 245];
const ORANGE_BG: [number, number, number] = [255, 243, 230];

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

function drawLogo(doc: jsPDF, x: number, y: number) {
  // Green square with white K
  doc.setFillColor(...GREEN);
  doc.roundedRect(x, y, 14, 14, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("K", x + 7, y + 10, { align: "center" });
}

function drawHeader(doc: jsPDF, title: string, subtitle: string, subtitleColor: [number, number, number]) {
  const pageW = doc.internal.pageSize.getWidth();
  drawLogo(doc, 14, 12);

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(BRAND.name, 31, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text(BRAND.tagline, 31, 23);

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, pageW - 14, 18, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...subtitleColor);
  doc.text(subtitle, pageW - 14, 24, { align: "right" });

  // Divider
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.line(14, 30, pageW - 14, 30);
}

function drawInfoBlock(
  doc: jsPDF,
  y: number,
  leftLabel: string,
  leftName: string,
  leftSub: string,
  rightLabel: string,
  rightValue: string,
  tglPo: string,
  accent: [number, number, number],
) {
  const pageW = doc.internal.pageSize.getWidth();
  const leftW = (pageW - 28) * 0.55;
  const rightX = 14 + leftW + 8;

  // Left label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(leftLabel, 14, y);

  // Left soft box w/ accent
  const boxY = y + 2;
  const boxH = 16;
  doc.setFillColor(...SOFT_BG);
  doc.rect(14, boxY, leftW, boxH, "F");
  doc.setFillColor(...accent);
  doc.rect(14, boxY, 1.5, boxH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  doc.text(leftName, 18, boxY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(leftSub, 18, boxY + 13);

  // Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(rightLabel, rightX, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text(rightValue, rightX, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("TANGGAL", rightX, y + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text(fmtDate(tglPo), rightX, y + 18);
}

function drawCatatan(doc: jsPDF, y: number, catatan: string | null): number {
  if (!catatan) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const w = pageW - 28;
  doc.setFillColor(...SOFT_BG);
  const lines = doc.splitTextToSize(catatan, w - 8);
  const h = 8 + lines.length * 4 + 4;
  doc.rect(14, y, w, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("CATATAN", 18, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(lines, 18, y + 12);
  return y + h;
}

function drawSignatures(
  doc: jsPDF,
  y: number,
  tglPo: string,
  leftLabel: string,
  rightLabel: string,
  signatureDataUrl: string,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const leftX = pageW * 0.28;
  const rightX = pageW * 0.72;

  // Top labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(leftLabel, leftX, y, { align: "center" });
  doc.text(rightLabel, rightX, y, { align: "center" });

  // Signature image (left only)
  try {
    const imgW = 30;
    const imgH = 16;
    doc.addImage(signatureDataUrl, "PNG", leftX - imgW / 2, y + 3, imgW, imgH);
  } catch {
    // ignore image errors
  }

  // Signature underline
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(leftX - 22, y + 22, leftX + 22, y + 22);
  doc.line(rightX - 22, y + 22, rightX + 22, y + 22);

  // Printed name (left) / blank (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(SIGNER_NAME, leftX, y + 27, { align: "center" });

  // Date below
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Tgl: ${fmtDate(tglPo)}`, leftX, y + 32, { align: "center" });
  doc.text("Tgl: ____________", rightX, y + 32, { align: "center" });
}

function drawFooter(doc: jsPDF, noPo: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const y = pageH - 22;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text(BRAND.store, 14, y + 6);
  doc.text(BRAND.legal, pageW - 14, y + 6, { align: "right" });

  doc.setDrawColor(235, 235, 235);
  doc.line(14, y + 10, pageW - 14, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Dokumen ini diterbitkan oleh ", 14, y + 15);
  const w = doc.getTextWidth("Dokumen ini diterbitkan oleh ");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ORANGE);
  doc.text(BRAND.store, 14 + w, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(noPo, pageW - 14, y + 15, { align: "right" });
}

export async function generatePoPdf(po: PoHeader, items: PoItem[]) {
  const sig = await loadSignature();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "PURCHASE ORDER", "SURAT PESANAN", MUTED);

  drawInfoBlock(
    doc,
    38,
    "DIAJUKAN KEPADA",
    BRAND.name,
    BRAND.legal,
    "NOMOR PO",
    po.no_po,
    po.tgl_po,
    GREEN,
  );

  autoTable(doc, {
    startY: 64,
    head: [["NO", "KODE", "NAMA BARANG", "SATUAN", "QTY", "HARGA", "DISC", "SUBTOTAL"]],
    body: items.map((it) => [
      String(it.no_item),
      it.kode,
      it.nama_produk,
      it.kemasan ?? "-",
      String(it.qty),
      fmtIDR(it.harga),
      `${it.disc_percent}%`,
      fmtIDR(it.subtotal),
    ]),
    styles: { fontSize: 9, cellPadding: 3, textColor: BLACK as [number, number, number], lineColor: [230, 230, 230] as [number, number, number] },
    headStyles: { fillColor: BLACK as [number, number, number], textColor: 255, fontStyle: "bold", fontSize: 8, halign: "left" },
    alternateRowStyles: { fillColor: [250, 250, 250] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22, font: "courier", fontSize: 8, textColor: [60, 60, 200] as [number, number, number] },
      2: { cellWidth: "auto", fontStyle: "bold" },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 16, halign: "right", textColor: ORANGE as [number, number, number], fontStyle: "bold" },
      7: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const pageW = doc.internal.pageSize.getWidth();

  // Summary box (right)
  const sumW = 80;
  const sumX = pageW - 14 - sumW;
  let sy = finalY;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);

  doc.rect(sumX, sy, sumW, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("Subtotal", sumX + 4, sy + 6);
  doc.setFont("helvetica", "bold");
  doc.text(`Rp ${fmtIDR(po.subtotal)}`, sumX + sumW - 4, sy + 6, { align: "right" });
  sy += 9;

  doc.rect(sumX, sy, sumW, 9);
  doc.setFont("helvetica", "normal");
  doc.text("PPN 11%", sumX + 4, sy + 6);
  doc.setFont("helvetica", "bold");
  doc.text(`Rp ${fmtIDR(po.ppn)}`, sumX + sumW - 4, sy + 6, { align: "right" });
  sy += 9;

  doc.setFillColor(...GREEN);
  doc.rect(sumX, sy, sumW, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grand Total", sumX + 4, sy + 7);
  doc.text(`Rp ${fmtIDR(po.grand_total)}`, sumX + sumW - 4, sy + 7, { align: "right" });

  const afterSum = sy + 11 + 6;
  const afterCat = drawCatatan(doc, afterSum, po.catatan);
  drawSignatures(doc, afterCat + 18, po.tgl_po, "Pemohon", "Mengetahui");
  drawFooter(doc, po.no_po);

  doc.save(`PO_${po.no_po}.pdf`);
}

export function generateSuratJalanPdf(po: PoHeader, items: PoItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "SURAT JALAN", "SEMENTARA", ORANGE);

  const pageW = doc.internal.pageSize.getWidth();

  // Orange dashed banner
  const bannerY = 35;
  doc.setFillColor(...ORANGE_BG);
  doc.rect(14, bannerY, pageW - 28, 9, "F");
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.4);
  doc.rect(14, bannerY, pageW - 28, 9);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ORANGE);
  doc.text(
    `DOKUMEN SEMENTARA — Mengacu pada Purchase Order ${po.no_po}`,
    pageW / 2,
    bannerY + 6,
    { align: "center" },
  );

  drawInfoBlock(
    doc,
    50,
    "DIKIRIM KEPADA",
    `${BRAND.name} Online Store`,
    "Stok Penjualan Marketplace",
    "REFERENSI PO",
    po.no_po,
    po.tgl_po,
    ORANGE,
  );

  autoTable(doc, {
    startY: 76,
    head: [["NO", "KODE", "NAMA BARANG", "SATUAN", "QTY"]],
    body: items.map((it) => [
      String(it.no_item),
      it.kode,
      it.nama_produk,
      it.kemasan ?? "-",
      String(it.qty),
    ]),
    styles: { fontSize: 10, cellPadding: 3.5, textColor: BLACK as [number, number, number], lineColor: [230, 230, 230] as [number, number, number] },
    headStyles: { fillColor: BLACK as [number, number, number], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "left" },
    alternateRowStyles: { fillColor: [250, 250, 250] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 26, font: "courier", fontSize: 8, textColor: [60, 60, 200] as [number, number, number] },
      2: { cellWidth: "auto", fontStyle: "bold" },
      3: { cellWidth: 38, halign: "right" },
      4: { cellWidth: 16, halign: "center" },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const afterCat = drawCatatan(doc, finalY, po.catatan);
  drawSignatures(doc, afterCat + 18, po.tgl_po, "Pengirim", "Penerima");
  drawFooter(doc, po.no_po);

  doc.save(`SJ_${po.no_po}.pdf`);
}

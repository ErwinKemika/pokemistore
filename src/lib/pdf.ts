import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type PoHeader = {
  no_po: string;
  tgl_po: string; // YYYY-MM-DD
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

const COMPANY = {
  name: "KEMIKA SUKSES",
  address: "Jl. Contoh No. 123, Jakarta",
  phone: "Telp: 021-1234567",
};

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

function drawHeader(doc: jsPDF, title: string, po: PoHeader) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(COMPANY.name, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(COMPANY.address, 14, 22);
  doc.text(COMPANY.phone, 14, 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const pageW = doc.internal.pageSize.getWidth();
  doc.text(title, pageW - 14, 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`No  : ${po.no_po}`, pageW - 14, 25, { align: "right" });
  doc.text(`Tgl : ${fmtDate(po.tgl_po)}`, pageW - 14, 30, { align: "right" });

  doc.setLineWidth(0.5);
  doc.line(14, 35, pageW - 14, 35);
}

export function generatePoPdf(po: PoHeader, items: PoItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "PURCHASE ORDER", po);

  autoTable(doc, {
    startY: 40,
    head: [["No", "Kode", "Nama Barang", "Kemasan", "Qty", "Harga", "Disc %", "Subtotal"]],
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
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [2, 172, 79], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 24 },
      4: { cellWidth: 14, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 28, halign: "right" },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(10);
  const labelX = pageW - 70;
  const valueX = pageW - 14;
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", labelX, finalY);
  doc.text(fmtIDR(po.subtotal), valueX, finalY, { align: "right" });
  doc.text("PPN 11%", labelX, finalY + 5);
  doc.text(fmtIDR(po.ppn), valueX, finalY + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Grand Total", labelX, finalY + 11);
  doc.text(`Rp ${fmtIDR(po.grand_total)}`, valueX, finalY + 11, { align: "right" });

  if (po.catatan) {
    doc.setFont("helvetica", "bold");
    doc.text("Catatan:", 14, finalY);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(po.catatan, pageW - 90);
    doc.text(lines, 14, finalY + 5);
  }

  // Signature
  const sigY = finalY + 35;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Hormat kami,", 14, sigY);
  doc.text("Penerima,", pageW - 60, sigY);
  doc.text("(_____________________)", 14, sigY + 25);
  doc.text("(_____________________)", pageW - 60, sigY + 25);

  doc.save(`PO_${po.no_po}.pdf`);
}

export function generateSuratJalanPdf(po: PoHeader, items: PoItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "SURAT JALAN", po);

  autoTable(doc, {
    startY: 40,
    head: [["No", "Kode", "Nama Barang", "Kemasan", "Qty"]],
    body: items.map((it) => [
      String(it.no_item),
      it.kode,
      it.nama_produk,
      it.kemasan ?? "-",
      String(it.qty),
    ]),
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [2, 172, 79], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 30 },
      4: { cellWidth: 20, halign: "right" },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Barang yang tercantum di atas telah diterima dalam keadaan baik dan sesuai pesanan.",
    14,
    finalY,
  );

  const sigY = finalY + 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Pengirim,", 14, sigY);
  doc.text("Penerima,", pageW - 60, sigY);
  doc.text("(_____________________)", 14, sigY + 25);
  doc.text("(_____________________)", pageW - 60, sigY + 25);
  doc.text("Tgl: ____ / ____ / ______", 14, sigY + 32);
  doc.text("Tgl: ____ / ____ / ______", pageW - 60, sigY + 32);

  doc.save(`SJ_${po.no_po}.pdf`);
}

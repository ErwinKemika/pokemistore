import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Download, Truck, Loader2, Search, Trash2, Eye, ChevronDown, FileDown, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { generatePoPdf, generateSuratJalanPdf, type PoHeader, type PoItem } from "@/lib/pdf";

const STATUS_OPTIONS = [
  "draft",
  "terkirim",
  "diproses",
  "diterima",
  "ditagih",
  "lunas",
  "dibatalkan",
] as const;

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  terkirim: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  diproses: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  diterima: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  ditagih: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  lunas: "bg-primary/15 text-primary",
  dibatalkan: "bg-destructive/15 text-destructive",
};

export const Route = createFileRoute("/_authenticated/po/")({
  component: PoIndex,
});

type PoRow = PoHeader & { id: string; status: string };

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function PoIndex() {
  const [rows, setRows] = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [deleteStep1, setDeleteStep1] = useState<PoRow | null>(null);
  const [deleteStep2, setDeleteStep2] = useState<PoRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const prevUrlRef = useRef<string | null>(null);

  // Export modal state
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"range" | "all">("range");
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const closePreview = () => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setPreviewUrl(null);
  };

  // Compute POs that match modal selection (for preview & export)
  const selectedPos = useMemo(() => {
    if (exportMode === "all") return rows;
    if (!dateFrom || !dateTo) return [];
    return rows.filter((r) => {
      if (r.tgl_po < dateFrom || r.tgl_po > dateTo) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, exportMode, dateFrom, dateTo, statusFilter]);

  const [previewCount, setPreviewCount] = useState<{ items: number; loading: boolean }>({ items: 0, loading: false });

  useEffect(() => {
    if (!exportOpen) return;
    if (selectedPos.length === 0) {
      setPreviewCount({ items: 0, loading: false });
      return;
    }
    let cancelled = false;
    setPreviewCount((p) => ({ ...p, loading: true }));
    (async () => {
      const { count } = await supabase
        .from("po_items")
        .select("id", { count: "exact", head: true })
        .in("po_id", selectedPos.map((p) => p.id));
      if (!cancelled) setPreviewCount({ items: count ?? 0, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [exportOpen, selectedPos]);

  const dateRangeInvalid = exportMode === "range" && (!dateFrom || !dateTo || dateFrom > dateTo);

  const handleExportCsv = async () => {
    if (exportMode === "range") {
      if (!dateFrom || !dateTo) {
        toast.error("Tanggal Mulai dan Tanggal Akhir wajib diisi");
        return;
      }
      if (dateFrom > dateTo) {
        toast.error("Tanggal Mulai tidak boleh lebih besar dari Tanggal Akhir");
        return;
      }
    }
    if (selectedPos.length === 0) {
      toast.error("Tidak ada data PO pada periode/filter yang dipilih.");
      return;
    }
    setExporting(true);
    try {
      const ids = selectedPos.map((r) => r.id);
      const { data, error } = await supabase
        .from("po_items")
        .select("id,po_id,no_item,kode,nama_produk,kemasan,qty,harga,subtotal")
        .in("po_id", ids)
        .order("no_item");
      if (error) throw error;
      const items = data ?? [];
      if (items.length === 0) {
        toast.error("Tidak ada data PO pada periode/filter yang dipilih.");
        return;
      }
      const byPo = new Map<string, PoRow>();
      selectedPos.forEach((p) => byPo.set(p.id, p));
      const rowsItems = items.slice().sort((a, b) => {
        const pa = byPo.get(a.po_id as string);
        const pb = byPo.get(b.po_id as string);
        if (!pa || !pb) return 0;
        if (pa.tgl_po !== pb.tgl_po) return pa.tgl_po < pb.tgl_po ? 1 : -1;
        if (pa.no_po !== pb.no_po) return pa.no_po < pb.no_po ? 1 : -1;
        return (a.no_item as number) - (b.no_item as number);
      });
      const headers = [
        "No","Tanggal PO","Nomor PO","ID Detail PO","Status PO","Kode Barang","Nama Barang","Vol","Unit","Harga Satuan","Harga Total Barang",
      ];
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(",")];
      rowsItems.forEach((it, idx) => {
        const po = byPo.get(it.po_id as string);
        if (!po) return;
        lines.push([
          idx + 1,
          po.tgl_po,
          po.no_po,
          (it as { id?: string }).id ?? it.no_item,
          po.status.charAt(0).toUpperCase() + po.status.slice(1),
          it.kode,
          it.nama_produk,
          it.qty,
          it.kemasan ?? "",
          Math.round(Number(it.harga) || 0),
          Math.round(Number(it.subtotal) || 0),
        ].map(esc).join(","));
      });
      const csv = "\uFEFF" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const compact = (d: string) => d.replace(/-/g, "");
      const fname = exportMode === "all"
        ? `riwayat-po-seluruh-data-${stamp}.csv`
        : `riwayat-po-${compact(dateFrom)}-sampai-${compact(dateTo)}.csv`;
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`CSV diexport: ${fname}`);
      setExportOpen(false);
    } catch (e) {
      toast.error("Gagal export CSV: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };


  const handleDelete = async () => {
    if (!deleteStep2) return;
    setDeleting(true);
    const po = deleteStep2;
    const { error: e1 } = await supabase.from("po_items").delete().eq("po_id", po.id);
    if (e1) {
      toast.error("Gagal hapus item: " + e1.message);
      setDeleting(false);
      return;
    }
    const { error: e2 } = await supabase.from("purchase_orders").delete().eq("id", po.id);
    if (e2) {
      toast.error("Gagal hapus PO: " + e2.message);
      setDeleting(false);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== po.id));
    toast.success(`PO ${po.no_po} dihapus`);
    setDeleting(false);
    setDeleteStep2(null);
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id,no_po,tgl_po,catatan,subtotal,ppn,grand_total,status")
        .order("tgl_po", { ascending: false })
        .order("no_po", { ascending: false });
      if (error) toast.error("Gagal memuat PO: " + error.message);
      setRows((data ?? []) as PoRow[]);
      setLoading(false);
    })();
  }, []);

  const handlePdf = async (po: PoRow, kind: "po" | "sj", mode: "download" | "preview") => {
    setPdfLoading(`${po.id}-${kind}`);
    try {
      const { data, error } = await supabase
        .from("po_items")
        .select("no_item,kode,nama_produk,kemasan,qty,harga,disc_percent,disc_rp,subtotal")
        .eq("po_id", po.id)
        .order("no_item");
      if (error) throw error;
      const items = (data ?? []) as PoItem[];
      if (items.length === 0) {
        toast.error("PO tidak memiliki item");
        return;
      }
      if (kind === "po") {
        const url = await generatePoPdf(po, items, mode);
        if (mode === "preview" && url) {
          prevUrlRef.current = url;
          setPreviewTitle(`PO — ${po.no_po}`);
          setPreviewUrl(url);
        }
      } else {
        const url = await generateSuratJalanPdf(po, items, mode);
        if (mode === "preview" && url) {
          prevUrlRef.current = url;
          setPreviewTitle(`Surat Jalan — ${po.no_po}`);
          setPreviewUrl(url);
        }
      }
    } catch (e) {
      toast.error("Gagal generate PDF: " + (e as Error).message);
    } finally {
      setPdfLoading(null);
    }
  };

  const updateStatus = async (po: PoRow, status: string) => {
    const prev = po.status;
    setRows((rs) => rs.map((r) => (r.id === po.id ? { ...r, status } : r)));
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status })
      .eq("id", po.id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === po.id ? { ...r, status: prev } : r)));
      toast.error("Gagal ubah status: " + error.message);
    } else {
      toast.success(`Status diubah ke "${status}"`);
    }
  };

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const filtered = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => r.no_po.toLowerCase().includes(needle));
  }, [rows, q]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; year: number; month: number; items: PoRow[]; total: number }>();
    filtered.forEach((r) => {
      const d = new Date(r.tgl_po);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m).padStart(2, "0")}`;
      let g = map.get(key);
      if (!g) {
        g = { key, year: y, month: m, items: [], total: 0 };
        map.set(key, g);
      }
      g.items.push(r);
      g.total += Number(r.grand_total) || 0;
    });
    const arr = Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
    arr.forEach((g) => g.items.sort((a, b) => (a.tgl_po < b.tgl_po ? 1 : a.tgl_po > b.tgl_po ? -1 : 0)));
    return arr;
  }, [filtered]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const initOpenRef = useRef(false);
  useEffect(() => {
    if (initOpenRef.current) return;
    if (groups.length > 0) {
      setOpenGroups(new Set([groups[0].key]));
      initOpenRef.current = true;
    }
  }, [groups]);

  useEffect(() => {
    if (!q) return;
    setOpenGroups(new Set(groups.map((g) => g.key)));
  }, [q, groups]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasActiveFilter = q !== "";
  const resetFilters = () => setQ("");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 text-primary" />
            Riwayat Purchase Order
          </h1>
          <p className="text-sm text-muted-foreground">
            Cetak PO atau Surat Jalan dalam format PDF
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportOpen(true)} disabled={loading}>
            <FileDown className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild>
            <Link to="/po/new">
              <Plus className="mr-2 h-4 w-4" /> Buat PO Baru
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nomor PO..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:items-center">
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="sm:w-[150px]"><SelectValue placeholder="Semua Bulan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Bulan</SelectItem>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="sm:w-[130px]"><SelectValue placeholder="Semua Tahun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={listStatusFilter} onValueChange={setListStatusFilter}>
                <SelectTrigger className="sm:w-[150px]"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="diproses">Diproses</SelectItem>
                  <SelectItem value="diterima">Diterima</SelectItem>
                  <SelectItem value="ditagih">Ditagih</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilter && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="sm:ml-auto col-span-2 sm:col-auto">
                  Reset Filter
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{filtered.length} PO ditemukan</Badge>
            {monthFilter !== "all" && (
              <Badge variant="outline">
                {MONTH_NAMES[Number(monthFilter)]}{yearFilter !== "all" ? ` ${yearFilter}` : ""}
              </Badge>
            )}
            {monthFilter === "all" && yearFilter !== "all" && (
              <Badge variant="outline">Tahun {yearFilter}</Badge>
            )}
            {listStatusFilter !== "all" && (
              <Badge variant="outline" className="capitalize">Status: {listStatusFilter}</Badge>
            )}
            {q && <Badge variant="outline">Pencarian: "{q}"</Badge>}
          </div>
        </div>


        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor PO</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Grand Total</TableHead>
                <TableHead className="w-72 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    {hasActiveFilter ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="font-semibold">Tidak ada PO ditemukan</p>
                        <p className="text-sm text-muted-foreground">Coba ubah kata kunci pencarian atau filter bulan/tahun.</p>
                        <Button variant="outline" size="sm" onClick={resetFilters} className="mt-2">Reset Filter</Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Belum ada PO. Klik "Buat PO Baru" untuk mulai.</span>
                    )}
                  </TableCell>
                </TableRow>

              ) : (
                filtered.map((po) => {
                  const loadingPo = pdfLoading === `${po.id}-po`;
                  const loadingSj = pdfLoading === `${po.id}-sj`;
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-sm font-medium">{po.no_po}</TableCell>
                      <TableCell>{fmtDate(po.tgl_po)}</TableCell>
                      <TableCell>
                        <Select value={po.status} onValueChange={(v) => updateStatus(po, v)}>
                          <SelectTrigger
                            className={`h-8 w-[130px] border-0 font-medium capitalize ${STATUS_COLOR[po.status] ?? "bg-muted"}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right pr-6 tabular-nums font-medium">
                        {fmtIDR(po.grand_total)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" disabled={loadingPo || loadingSj}>
                                {loadingPo ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileText className="mr-1 h-3.5 w-3.5" />
                                )}
                                PO
                                <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePdf(po, "po", "preview")}>
                                <Eye className="mr-2 h-4 w-4" /> Review
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePdf(po, "po", "download")}>
                                <Download className="mr-2 h-4 w-4" /> Unduh
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" disabled={loadingPo || loadingSj}>
                                {loadingSj ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Truck className="mr-1 h-3.5 w-3.5" />
                                )}
                                Surat Jalan
                                <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePdf(po, "sj", "preview")}>
                                <Eye className="mr-2 h-4 w-4" /> Review
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePdf(po, "sj", "download")}>
                                <Download className="mr-2 h-4 w-4" /> Unduh
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => setDeleteStep1(po)}
                            disabled={loadingPo || loadingSj}
                            aria-label="Hapus PO"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteStep1} onOpenChange={(o) => !o && setDeleteStep1(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus PO {deleteStep1?.no_po}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus PO beserta seluruh itemnya. Lanjutkan ke verifikasi
              kedua?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const po = deleteStep1;
                setDeleteStep1(null);
                setDeleteStep2(po);
              }}
            >
              Lanjut
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteStep2} onOpenChange={(o) => !o && !deleting && setDeleteStep2(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Konfirmasi Akhir
            </AlertDialogTitle>
            <AlertDialogDescription>
              Yakin hapus permanen <span className="font-mono font-semibold">{deleteStep2?.no_po}</span>?
              Data tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={exportOpen} onOpenChange={(o) => !exporting && setExportOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export CSV Riwayat PO</DialogTitle>
            <DialogDescription>Pilih data yang ingin diunduh.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={exportMode} onValueChange={(v) => setExportMode(v as "range" | "all")} className="space-y-2">
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="range" id="opt-range" className="mt-1" />
                <div className="flex-1 space-y-3">
                  <Label htmlFor="opt-range" className="font-medium cursor-pointer">Berdasarkan Rentang Tanggal</Label>
                  {exportMode === "range" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Tanggal Mulai</Label>
                          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tanggal Akhir</Label>
                          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Status PO</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="diproses">Diproses</SelectItem>
                            <SelectItem value="diterima">Diterima</SelectItem>
                            <SelectItem value="lunas">Lunas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {dateRangeInvalid && (
                        <p className="text-xs text-destructive">Tanggal Mulai tidak boleh lebih besar dari Tanggal Akhir.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="all" id="opt-all" className="mt-1" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="opt-all" className="font-medium cursor-pointer">Seluruh Riwayat PO</Label>
                  {exportMode === "all" && (
                    <div className="flex gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Export seluruh riwayat PO akan mengunduh semua data PO dari awal. Gunakan opsi ini hanya jika data lokal/Excel hilang atau ingin melakukan backup ulang seluruh data.</span>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>

            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
              <div className="font-medium mb-1">Preview</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Jumlah PO</span><span className="font-medium">{selectedPos.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Jumlah Item</span><span className="font-medium">{previewCount.loading ? "…" : previewCount.items}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Periode</span><span className="font-medium">{exportMode === "all" ? "Seluruh data" : `${dateFrom || "-"} s/d ${dateTo || "-"}`}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium capitalize">{exportMode === "all" ? "Semua" : statusFilter === "all" ? "Semua Status" : statusFilter}</span></div>
              {selectedPos.length === 0 && !dateRangeInvalid && (
                <p className="pt-2 text-xs text-destructive">Tidak ada data PO pada periode/filter yang dipilih.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>Batal</Button>
            <Button onClick={handleExportCsv} disabled={exporting || dateRangeInvalid || selectedPos.length === 0 || previewCount.loading || previewCount.items === 0}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Unduh CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent
          className="max-w-3xl w-[92vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col"
        >
          <div className="flex items-center border-b px-4 py-2.5 pr-12">
            <p className="text-sm font-semibold truncate">{previewTitle}</p>
          </div>
          {previewUrl && (
            <iframe
              src={previewUrl}
              title={previewTitle}
              className="flex-1 w-full border-0 bg-muted"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

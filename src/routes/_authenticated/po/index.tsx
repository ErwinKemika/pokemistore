import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Plus, Download, Truck, Loader2, Search, Trash2, Eye, ChevronDown } from "lucide-react";
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
      if (kind === "po") await generatePoPdf(po, items, mode);
      else await generateSuratJalanPdf(po, items, mode);
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

  const filtered = rows.filter((r) =>
    !q ? true : r.no_po.toLowerCase().includes(q.toLowerCase()),
  );

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
        <Button asChild>
          <Link to="/po/new">
            <Plus className="mr-2 h-4 w-4" /> Buat PO Baru
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b p-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nomor PO..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} PO</Badge>
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
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    Belum ada PO. Klik "Buat PO Baru" untuk mulai.
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
    </div>
  );
}

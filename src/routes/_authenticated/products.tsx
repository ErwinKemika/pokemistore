import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Package, Plus, Search, Upload, Download, Pencil, Trash2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/products")({
  component: Products,
});

type Product = {
  id: string;
  kode: string;
  nama_produk: string;
  kemasan: string | null;
  harga: number;
  disc_percent: number;
  deskripsi: string | null;
};

type FormState = {
  kode: string;
  nama_produk: string;
  kemasan: string;
  harga: string;
  disc_percent: string;
  deskripsi: string;
};

const emptyForm: FormState = {
  kode: "",
  nama_produk: "",
  kemasan: "",
  harga: "",
  disc_percent: "0",
  deskripsi: "",
};

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("master_products")
      .select("*")
      .order("kode", { ascending: true });
    if (error) toast.error("Gagal memuat: " + error.message);
    else setItems((data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.kode.toLowerCase().includes(q) ||
        p.nama_produk.toLowerCase().includes(q) ||
        (p.kemasan ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      kode: p.kode,
      nama_produk: p.nama_produk,
      kemasan: p.kemasan ?? "",
      harga: String(p.harga),
      disc_percent: String(p.disc_percent),
      deskripsi: p.deskripsi ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.kode.trim() || !form.nama_produk.trim()) {
      toast.error("Kode dan Nama Produk wajib diisi");
      return;
    }
    const payload = {
      kode: form.kode.trim(),
      nama_produk: form.nama_produk.trim(),
      kemasan: form.kemasan.trim() || null,
      harga: Number(form.harga) || 0,
      disc_percent: Number(form.disc_percent) || 0,
      deskripsi: form.deskripsi.trim() || null,
    };
    setSaving(true);
    const { error } = editing
      ? await supabase.from("master_products").update(payload).eq("id", editing.id)
      : await supabase.from("master_products").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
      return;
    }
    toast.success(editing ? "Barang diperbarui" : "Barang ditambahkan");
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("master_products").delete().eq("id", deleteId);
    if (error) toast.error("Gagal menghapus: " + error.message);
    else {
      toast.success("Barang dihapus");
      load();
    }
    setDeleteId(null);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const pick = (row: Record<string, unknown>, keys: string[]) => {
        for (const k of Object.keys(row)) {
          if (keys.includes(norm(k))) return row[k];
        }
        return "";
      };

      const records = rows
        .map((r) => ({
          kode: String(pick(r, ["kode", "kodebarang", "sku"]) ?? "").trim(),
          nama_produk: String(pick(r, ["namaproduk", "nama", "namabarang", "produk"]) ?? "").trim(),
          kemasan: String(pick(r, ["kemasan", "satuan", "unit"]) ?? "").trim() || null,
          harga: Number(pick(r, ["harga", "price", "hargasatuan"])) || 0,
          disc_percent: Number(pick(r, ["disc", "discpercent", "diskon", "diskonpersen"])) || 0,
          deskripsi: String(pick(r, ["deskripsi", "keterangan", "description"]) ?? "").trim() || null,
        }))
        .filter((r) => r.kode && r.nama_produk);

      if (records.length === 0) {
        toast.error("Tidak ada baris valid. Pastikan ada kolom 'kode' dan 'nama_produk'.");
        return;
      }

      const { data: existing } = await supabase.from("master_products").select("id, kode");
      const map = new Map((existing ?? []).map((e: { id: string; kode: string }) => [e.kode, e.id]));

      const toUpdate = records.filter((r) => map.has(r.kode));
      const toInsert = records.filter((r) => !map.has(r.kode));

      let okIns = 0,
        okUpd = 0,
        fail = 0;

      if (toInsert.length) {
        const { error } = await supabase.from("master_products").insert(toInsert);
        if (error) fail += toInsert.length;
        else okIns = toInsert.length;
      }
      for (const r of toUpdate) {
        const { error } = await supabase
          .from("master_products")
          .update(r)
          .eq("id", map.get(r.kode)!);
        if (error) fail++;
        else okUpd++;
      }

      toast.success(`Import selesai: ${okIns} baru, ${okUpd} diperbarui${fail ? `, ${fail} gagal` : ""}`);
      load();
    } catch (e) {
      toast.error("Gagal membaca file: " + (e as Error).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportExcel = () => {
    const data = filtered.map((p) => ({
      kode: p.kode,
      nama_produk: p.nama_produk,
      kemasan: p.kemasan ?? "",
      harga: p.harga,
      disc_percent: p.disc_percent,
      deskripsi: p.deskripsi ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Barang");
    XLSX.writeFile(wb, `master-barang-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        kode: "BRG-001",
        nama_produk: "Contoh Barang",
        kemasan: "Botol 100ml",
        harga: 25000,
        disc_percent: 0,
        deskripsi: "Deskripsi opsional",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template-master-barang.xlsx");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Package className="h-6 w-6 text-primary" />
            Master Barang
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola katalog produk untuk Purchase Order
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!items.length}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import Excel
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Barang
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b p-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari kode, nama, atau kemasan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} barang</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Kode</TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kemasan</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right w-20">Disc %</TableHead>
                <TableHead className="w-28 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    {items.length === 0
                      ? "Belum ada barang. Import Excel atau tambah manual."
                      : "Tidak ada barang cocok dengan pencarian."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.kode}</TableCell>
                    <TableCell className="font-medium">{p.nama_produk}</TableCell>
                    <TableCell className="text-muted-foreground">{p.kemasan ?? "-"}</TableCell>
                    <TableCell className="text-right">{fmtIDR(p.harga)}</TableCell>
                    <TableCell className="text-right">{p.disc_percent}%</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(p.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Barang" : "Tambah Barang Baru"}</DialogTitle>
            <DialogDescription>
              Isi detail produk. Kode harus unik.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kode">Kode *</Label>
                <Input
                  id="kode"
                  value={form.kode}
                  onChange={(e) => setForm({ ...form, kode: e.target.value })}
                  placeholder="BRG-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kemasan">Kemasan</Label>
                <Input
                  id="kemasan"
                  value={form.kemasan}
                  onChange={(e) => setForm({ ...form, kemasan: e.target.value })}
                  placeholder="Botol 100ml"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nama">Nama Produk *</Label>
              <Input
                id="nama"
                value={form.nama_produk}
                onChange={(e) => setForm({ ...form, nama_produk: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="harga">Harga (Rp)</Label>
                <Input
                  id="harga"
                  type="number"
                  min="0"
                  value={form.harga}
                  onChange={(e) => setForm({ ...form, harga: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="disc">Diskon (%)</Label>
                <Input
                  id="disc"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.disc_percent}
                  onChange={(e) => setForm({ ...form, disc_percent: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desk">Deskripsi</Label>
              <Textarea
                id="desk"
                rows={3}
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus barang ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Aksi ini tidak bisa dibatalkan. Barang akan dihapus permanen dari master.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

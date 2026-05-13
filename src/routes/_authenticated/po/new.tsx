import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FilePlus, Plus, Trash2, Search, Loader2, Save } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/po/new")({
  component: PoNew,
});

type Product = {
  id: string;
  kode: string;
  nama_produk: string;
  kemasan: string | null;
  harga: number;
  disc_percent: number;
};

type Item = {
  rowId: string;
  kode: string;
  nama_produk: string;
  kemasan: string;
  qty: number;
  harga: number;
  disc_percent: number;
};

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const today = () => new Date().toISOString().slice(0, 10);

const newRow = (): Item => ({
  rowId: crypto.randomUUID(),
  kode: "",
  nama_produk: "",
  kemasan: "",
  qty: 1,
  harga: 0,
  disc_percent: 0,
});

function calcSubtotal(it: Item) {
  const gross = it.qty * it.harga;
  const disc = (gross * it.disc_percent) / 100;
  return Math.max(0, gross - disc);
}

async function generatePoNumber(dateStr: string): Promise<string> {
  // dateStr: YYYY-MM-DD
  const ymd = dateStr.replaceAll("-", "");
  const prefix = `DO.${ymd}.`;
  const { data } = await supabase
    .from("purchase_orders")
    .select("no_po")
    .like("no_po", `${prefix}%KS`)
    .order("no_po", { ascending: false })
    .limit(1);
  let next = 1;
  if (data && data.length) {
    const last = data[0].no_po as string;
    const mid = last.slice(prefix.length, prefix.length + 2);
    const n = parseInt(mid, 10);
    if (!isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(2, "0")}KS`;
}

function PoNew() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [noPo, setNoPo] = useState("");
  const [tglPo, setTglPo] = useState(today());
  const [catatan, setCatatan] = useState("");
  const [includePpn, setIncludePpn] = useState(false);
  const [items, setItems] = useState<Item[]>([newRow()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: prods }, no] = await Promise.all([
        supabase.from("master_products").select("id,kode,nama_produk,kemasan,harga,disc_percent").order("kode"),
        generatePoNumber(tglPo),
      ]);
      setProducts((prods ?? []) as Product[]);
      setNoPo(no);
      setLoadingProducts(false);
    })();
  }, []);

  // Regenerate PO number when date changes
  useEffect(() => {
    if (loadingProducts) return;
    generatePoNumber(tglPo).then(setNoPo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tglPo]);

  const update = (rowId: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.rowId === rowId ? { ...it, ...patch } : it)));
  };

  const removeRow = (rowId: string) => {
    setItems((prev) => (prev.length === 1 ? [newRow()] : prev.filter((it) => it.rowId !== rowId)));
  };

  const pickProduct = (rowId: string, p: Product) => {
    update(rowId, {
      kode: p.kode,
      nama_produk: p.nama_produk,
      kemasan: p.kemasan ?? "",
      harga: Number(p.harga) || 0,
      disc_percent: Number(p.disc_percent) || 0,
    });
  };

  const subtotal = useMemo(() => items.reduce((s, it) => s + calcSubtotal(it), 0), [items]);
  const ppn = includePpn ? Math.round(subtotal * 0.11) : 0;
  const grandTotal = subtotal + ppn;

  const validItems = items.filter((it) => it.kode && it.nama_produk && it.qty > 0);

  const save = async (status: "draft" | "terkirim") => {
    if (!noPo.trim()) return toast.error("Nomor PO wajib diisi");
    if (validItems.length === 0) return toast.error("Tambahkan minimal 1 item");

    setSaving(true);
    const { data: poData, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        no_po: noPo.trim(),
        tgl_po: tglPo,
        catatan: catatan.trim() || null,
        status,
        subtotal,
        ppn,
        grand_total: grandTotal,
      })
      .select("id")
      .single();

    if (poErr || !poData) {
      setSaving(false);
      return toast.error("Gagal simpan PO: " + (poErr?.message ?? "unknown"));
    }

    const itemsPayload = validItems.map((it, idx) => {
      const gross = it.qty * it.harga;
      const discRp = (gross * it.disc_percent) / 100;
      return {
        po_id: poData.id,
        no_item: idx + 1,
        kode: it.kode,
        nama_produk: it.nama_produk,
        kemasan: it.kemasan || null,
        qty: it.qty,
        harga: it.harga,
        disc_percent: it.disc_percent,
        disc_rp: discRp,
        subtotal: gross - discRp,
      };
    });

    const { error: itErr } = await supabase.from("po_items").insert(itemsPayload);
    setSaving(false);
    if (itErr) return toast.error("Gagal simpan item: " + itErr.message);

    toast.success(status === "draft" ? "PO disimpan sebagai draft" : "PO berhasil dibuat");
    navigate({ to: "/po" });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FilePlus className="h-6 w-6 text-primary" />
            Buat Purchase Order
          </h1>
          <p className="text-sm text-muted-foreground">
            Pilih barang dari master, qty dan harga otomatis terisi
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save("draft")} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Draft
          </Button>
          <Button onClick={() => save("terkirim")} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Buat PO
          </Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="no_po">Nomor PO</Label>
          <Input id="no_po" value={noPo} onChange={(e) => setNoPo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tgl_po">Tanggal</Label>
          <Input id="tgl_po" type="date" value={tglPo} onChange={(e) => setTglPo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Badge variant="secondary" className="h-9 px-3 text-sm">
            {loadingProducts ? "Memuat barang..." : `${products.length} barang tersedia`}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Item Barang</h2>
          <Button size="sm" variant="outline" onClick={() => setItems((p) => [...p, newRow()])}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Baris
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead className="min-w-[280px]">Barang</TableHead>
                <TableHead className="w-32">Kemasan</TableHead>
                <TableHead className="w-20 pr-6 text-right">Qty</TableHead>
                <TableHead className="w-32 pr-6 text-right">Harga</TableHead>
                <TableHead className="w-24 pr-6 text-right">Disc %</TableHead>
                <TableHead className="w-36 pr-6 text-right">Subtotal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <ItemRow
                  key={it.rowId}
                  index={idx}
                  item={it}
                  products={products}
                  onPick={(p) => pickProduct(it.rowId, p)}
                  onUpdate={(patch) => update(it.rowId, patch)}
                  onRemove={() => removeRow(it.rowId)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-1.5">
          <Label htmlFor="catatan">Catatan</Label>
          <Textarea
            id="catatan"
            rows={4}
            placeholder="Catatan untuk supplier (opsional)..."
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{fmtIDR(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includePpn}
                onCheckedChange={(v) => setIncludePpn(!!v)}
              />
              <span className="text-muted-foreground">PPN 11%</span>
            </label>
            <span className="font-medium">{fmtIDR(ppn)}</span>
          </div>
          <div className="flex justify-between border-t pt-3 text-base">
            <span className="font-semibold">Grand Total</span>
            <span className="font-bold text-primary">{fmtIDR(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  index,
  item,
  products,
  onPick,
  onUpdate,
  onRemove,
}: {
  index: number;
  item: Item;
  products: Product[];
  onPick: (p: Product) => void;
  onUpdate: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sub = calcSubtotal(item);

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={cn("w-full justify-between font-normal", !item.kode && "text-muted-foreground")}
            >
              {item.kode ? (
                <span className="truncate">
                  <span className="font-mono text-xs text-muted-foreground">{item.kode}</span>{" "}
                  <span>{item.nama_produk}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" /> Cari barang...
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <Command
              filter={(value, search) => {
                const v = value.toLowerCase();
                const s = search.toLowerCase();
                return v.includes(s) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="Ketik kode atau nama barang..." />
              <CommandList>
                <CommandEmpty>Barang tidak ditemukan.</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.kode} ${p.nama_produk} ${p.kemasan ?? ""}`}
                      onSelect={() => {
                        onPick(p);
                        setOpen(false);
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{p.nama_produk}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{p.kode}</span>
                            {p.kemasan ? ` · ${p.kemasan}` : ""}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-right whitespace-nowrap">
                          {fmtIDR(p.harga)}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell>
        <Input
          value={item.kemasan}
          onChange={(e) => onUpdate({ kemasan: e.target.value })}
          placeholder="-"
          className="h-9"
        />
      </TableCell>
      <TableCell className="pr-6">
        <Input
          type="text"
          inputMode="numeric"
          value={item.qty}
          onChange={(e) => onUpdate({ qty: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) })}
          className="h-9 text-right tabular-nums"
        />
      </TableCell>
      <TableCell className="pr-6">
        <Input
          type="text"
          inputMode="numeric"
          value={item.harga}
          onChange={(e) => onUpdate({ harga: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) })}
          className="h-9 text-right tabular-nums"
        />
      </TableCell>
      <TableCell className="pr-6">
        <Input
          type="text"
          inputMode="decimal"
          value={item.disc_percent}
          onChange={(e) => onUpdate({ disc_percent: Math.max(0, Math.min(100, Number(e.target.value.replace(",", ".")) || 0)) })}
          className="h-9 text-right tabular-nums"
        />
      </TableCell>
      <TableCell className="pr-6 text-right font-medium tabular-nums">{fmtIDR(sub)}</TableCell>
      <TableCell>
        <Button size="icon" variant="ghost" onClick={onRemove} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

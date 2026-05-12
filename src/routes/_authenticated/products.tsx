import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/products")({
  component: Products,
});

function Products() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Package className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Master Barang</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Kelola katalog produk: import dari Excel, tambah manual, edit, dan ekspor. (Tahap berikutnya)
        </p>
      </div>
    </div>
  );
}

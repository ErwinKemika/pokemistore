import { createFileRoute } from "@tanstack/react-router";
import { FilePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/po/new")({
  component: PoNew,
});

function PoNew() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FilePlus className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Buat Purchase Order</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Form pembuatan PO dengan auto-lookup barang dan kalkulasi otomatis. (Tahap berikutnya)
        </p>
      </div>
    </div>
  );
}

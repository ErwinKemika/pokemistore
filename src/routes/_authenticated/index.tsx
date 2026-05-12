import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-5xl">
      <EmptyState
        icon={<LayoutDashboard className="h-10 w-10 text-muted-foreground" />}
        title="Dashboard"
        desc="Statistik PO, total belanja bulanan, dan ringkasan akan tampil di sini. (Tahap berikutnya)"
      />
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

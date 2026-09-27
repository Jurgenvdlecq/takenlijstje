import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="rounded-full bg-accent p-4 text-accent-foreground">
        <CloudOff className="size-7" />
      </div>
      <h1 className="text-xl font-semibold">Je bent offline</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Deze pagina is nog niet eerder geladen. Zodra je weer verbinding hebt, werkt alles weer zoals gewoonlijk.
      </p>
    </main>
  );
}

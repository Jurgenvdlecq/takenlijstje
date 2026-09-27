import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { getUser } from "@/server/context";

export const metadata = { title: "Inloggen" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const configured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

  if (configured) {
    const { user } = await getUser();
    if (user) redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-3xl bg-primary text-3xl shadow-lg shadow-primary/25">
          🏡
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Takenlijstje</h1>
        <p className="mt-1 text-sm text-muted-foreground">Samen het huishouden op orde, zonder gedoe.</p>
      </div>
      {configured ? (
        <LoginForm next={next} initialMode={params.mode === "register" ? "register" : "login"} linkError={params.fout === "link"} />
      ) : (
        <div className="rounded-2xl border border-dashed p-5 text-sm">
          <p className="font-medium">Supabase is nog niet ingesteld.</p>
          <p className="mt-1 text-muted-foreground">
            Kopieer <code>.env.example</code> naar <code>.env.local</code> en vul de Supabase-gegevens in. Zie de README.
          </p>
        </div>
      )}
    </main>
  );
}

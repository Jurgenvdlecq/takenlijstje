"use client";

import { Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { publicEnv } from "@/lib/env";
import { getBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "magic" | "register";

/** Vertaal de meest voorkomende Supabase Auth-fouten. */
function authError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mailadres of wachtwoord klopt niet.";
  if (/email not confirmed/i.test(message)) return "Bevestig eerst je e-mailadres via de link in je mail.";
  if (/already registered|already been registered/i.test(message)) return "Er bestaat al een account met dit e-mailadres.";
  if (/password should be at least/i.test(message)) return "Kies een wachtwoord van minimaal 8 tekens.";
  if (/rate limit|too many/i.test(message)) return "Even geduld: te veel pogingen. Probeer het zo opnieuw.";
  return "Inloggen lukte niet. Probeer het opnieuw.";
}

export function LoginForm({ next, initialMode, linkError }: { next: string; initialMode: "login" | "register"; linkError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (linkError) toast.error("Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.");
    // Na uitloggen: lokale offline-gegevens van het vorige account wissen
    try {
      indexedDB.deleteDatabase("takenlijstje-cache");
      indexedDB.deleteDatabase("takenlijstje-outbox");
    } catch {
      // niet beschikbaar
    }
  }, [linkError]);

  const callback = `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = getBrowserClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
        return;
      }
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback } });
        if (error) throw error;
        setSentTo(email);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callback, data: { display_name: name.trim() || undefined } },
      });
      if (error) throw error;
      if (data.session) {
        router.replace(next);
        router.refresh();
      } else {
        setSentTo(email);
      }
    } catch (error) {
      toast.error(authError((error as Error).message ?? ""));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="grid gap-3 rounded-2xl border bg-card p-6 text-center">
        <div className="mx-auto rounded-full bg-accent p-3 text-accent-foreground">
          <Mail className="size-6" />
        </div>
        <p className="font-medium">Check je mail</p>
        <p className="text-sm text-muted-foreground">
          We hebben een link gestuurd naar <strong>{sentTo}</strong>. Tik op de link om verder te gaan.
        </p>
        <Button variant="ghost" onClick={() => setSentTo(null)}>
          Ander e-mailadres
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-card p-5 shadow-xs">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="login">Inloggen</TabsTrigger>
          <TabsTrigger value="magic">Via e-mail</TabsTrigger>
          <TabsTrigger value="register">Nieuw</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "register" && (
        <Field label="Je naam" htmlFor="name">
          <Input id="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Jurgen" />
        </Field>
      )}
      <Field label="E-mailadres" htmlFor="email">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="naam@voorbeeld.nl"
        />
      </Field>
      {mode !== "magic" && (
        <Field label="Wachtwoord" htmlFor="password" hint={mode === "register" ? "Minimaal 8 tekens" : undefined}>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      )}
      {mode === "magic" && (
        <p className="text-sm text-muted-foreground">Je krijgt een link per e-mail waarmee je direct bent ingelogd. Geen wachtwoord nodig.</p>
      )}

      <Button type="submit" size="lg" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        {mode === "login" ? "Inloggen" : mode === "magic" ? "Stuur inloglink" : "Account aanmaken"}
      </Button>
    </form>
  );
}

/**
 * Publieke omgevingsvariabelen (veilig in de browser).
 *
 * Next.js bakt `process.env.NEXT_PUBLIC_*` normaal vast tijdens de build.
 * Staan ze op dat moment (nog) niet goed, dan blijft de app leeg tot een
 * nieuwe build. Daarom lezen we ze hier tijdens het draaien:
 *  - op de server met een dynamische sleutel (wordt niet vastgebakken);
 *  - in de browser uit `window.__TAKENLIJSTJE_ENV__`, die de root-layout
 *    per verzoek meestuurt (zie PublicEnvScript).
 * De letterlijke verwijzingen blijven als terugval voor lokale ontwikkeling.
 */
export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  vapidPublicKey: string;
}

declare global {
  interface Window {
    __TAKENLIJSTJE_ENV__?: Partial<PublicEnv>;
  }
}

const KEYS: Record<keyof PublicEnv, string> = {
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  siteUrl: "NEXT_PUBLIC_SITE_URL",
  vapidPublicKey: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
};

/** Tijdens de build ingebakken waarden (kunnen leeg zijn). */
const BUILD_TIME: PublicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function read(key: keyof PublicEnv): string {
  let value: string;
  if (typeof window !== "undefined") {
    value = clean(window.__TAKENLIJSTJE_ENV__?.[key]) || clean(BUILD_TIME[key]);
  } else {
    // Dynamische sleutel: Next.js vervangt dit niet tijdens de build
    const env = process.env as Record<string, string | undefined>;
    value = clean(env[KEYS[key]]) || clean(BUILD_TIME[key]);
  }
  if (key === "siteUrl") return (value || "http://localhost:3000").replace(/\/+$/, "");
  return value;
}

export const publicEnv: PublicEnv = {
  get supabaseUrl() {
    return read("supabaseUrl");
  },
  get supabaseAnonKey() {
    return read("supabaseAnonKey");
  },
  get siteUrl() {
    return read("siteUrl");
  },
  get vapidPublicKey() {
    return read("vapidPublicKey");
  },
};

/** Momentopname voor de browser (alleen publieke waarden!). */
export function publicEnvSnapshot(): PublicEnv {
  return {
    supabaseUrl: publicEnv.supabaseUrl,
    supabaseAnonKey: publicEnv.supabaseAnonKey,
    siteUrl: publicEnv.siteUrl,
    vapidPublicKey: publicEnv.vapidPublicKey,
  };
}

export function assertSupabaseConfigured(): void {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "Supabase is niet geconfigureerd. Zet NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY (zie .env.example).",
    );
  }
}

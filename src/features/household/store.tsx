"use client";

/**
 * Centrale client-state van het huishouden.
 *  - start met de snapshot die de server meestuurt
 *  - ververst bij realtime-wijzigingen van andere gezinsleden
 *  - bewaart de laatste stand in IndexedDB (offline bekijken)
 *  - voert acties optimistisch uit en zet ze offline in de wachtrij
 */
import * as React from "react";
import { toast } from "sonner";
import { loadSnapshot, type Snapshot } from "@/lib/data/snapshot";
import { readCachedSnapshot, writeCachedSnapshot } from "@/lib/offline/cache";
import { isNetworkError, readOutbox, writeOutbox, type OutboxEntry } from "@/lib/offline/outbox";
import { OUTBOX_VERSION } from "@/domain/outbox/migrate";
import { getBrowserClient } from "@/lib/supabase/client";
import { newId } from "@/lib/utils";
import type { ActionResult } from "@/server/errors";
import type { CompletionRow, NotificationRow } from "@/types/database";
import {
  applyOptimistic,
  isOfflineCapable,
  sendMutation,
  type MutationKind,
  type MutationPayload,
} from "./mutations";

interface HouseholdStore {
  snapshot: Snapshot;
  online: boolean;
  /** Aantal acties dat nog verstuurd moet worden */
  pending: number;
  refresh: () => Promise<void>;
  /** Snelle actie (optimistisch, offline-bestendig) */
  mutate: <K extends MutationKind>(kind: K, payload: MutationPayload<K>) => Promise<boolean>;
  /** Gewone server action met foutmelding en verversen na afloop */
  run: <T>(action: () => Promise<ActionResult<T>>, options?: { success?: string }) => Promise<T | null>;
}

const StoreContext = React.createContext<HouseholdStore | null>(null);

export function useHousehold(): HouseholdStore {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useHousehold buiten HouseholdProvider");
  return ctx;
}

export function useSnapshot(): Snapshot {
  return useHousehold().snapshot;
}

const REALTIME_TABLES = [
  "tasks",
  "task_completions",
  "task_comments",
  "shopping_items",
  "shopping_lists",
  "household_members",
] as const;

export function HouseholdProvider({ initial, children }: { initial: Snapshot; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = React.useState(initial);
  const [online, setOnline] = React.useState(true);
  const [pending, setPending] = React.useState(0);

  const householdId = initial.household.id;
  const meId = initial.me.id;

  // Refs voor de nieuwste waarden binnen callbacks
  const inFlight = React.useRef(new Map<string, OutboxEntry>());
  const outbox = React.useRef<OutboxEntry[]>([]);
  const ownMutationIds = React.useRef(new Set<string>());
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefresh = React.useRef(0);
  const flushing = React.useRef(false);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Backoff bij netwerkfouten terwijl de browser online is (telt niet mee voor MAX_ATTEMPTS)
  const networkRetries = React.useRef(0);

  const ctx = React.useCallback(() => ({ meId, now: new Date().toISOString() }), [meId]);

  /** Nog niet bevestigde acties opnieuw toepassen op verse data */
  const reapplyPending = React.useCallback(
    (s: Snapshot) =>
      [...outbox.current, ...inFlight.current.values()].reduce(
        (acc, entry) => applyOptimistic(acc, entry.kind, entry.payload, ctx()),
        s,
      ),
    [ctx],
  );

  const refresh = React.useCallback(async () => {
    lastRefresh.current = Date.now();
    try {
      const fresh = await loadSnapshot(getBrowserClient(), householdId, meId);
      setSnapshot(reapplyPending(fresh));
      try {
        sessionStorage.removeItem("tl-reload-geen-huishouden");
      } catch {
        // negeren
      }
    } catch (error) {
      if (isNetworkError(error)) return;
      // Geen huishouden meer zichtbaar (uitgezet of verwijderd): de server beslist
      // waarheen (TECHNICAL_DESIGN §4.3); /geen-toegang wist de lokale gegevens
      if ((error as { code?: string })?.code === "PGRST116") {
        // Eén keer herladen; toont de server de pagina toch weer, dan geen lus
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem("tl-reload-geen-huishouden") === "1";
          sessionStorage.setItem("tl-reload-geen-huishouden", "1");
        } catch {
          // Geen sessionStorage: toch één keer herladen
        }
        if (!reloaded) window.location.reload();
        return;
      }
      console.error("[store] verversen mislukt");
    }
  }, [householdId, meId, reapplyPending]);

  const scheduleRefresh = React.useCallback(
    (delay = 400) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void refresh(), delay);
    },
    [refresh],
  );

  const updatePending = React.useCallback(() => setPending(outbox.current.length + inFlight.current.size), []);

  // Nieuwste stand voor meldingen over wachtrij-items (titel van de taak)
  const snapshotRef = React.useRef(snapshot);
  React.useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  /** "1 offline wijziging kon niet worden verwerkt: Stofzuigen (reden)" (AC-032) */
  const rejectedMessage = React.useCallback((entry: OutboxEntry, reason: string) => {
    const payload = (entry.payload ?? {}) as { taskId?: string; id?: string };
    const s = snapshotRef.current;
    const title =
      (payload.taskId && s.tasks.find((t) => t.id === payload.taskId)?.title) ||
      (payload.id && s.shoppingItems.find((i) => i.id === payload.id)?.name) ||
      null;
    return `1 offline wijziging kon niet worden verwerkt${title ? `: ${title}` : ""} (${reason.replace(/\.$/, "")})`;
  }, []);

  const flushOutboxRef = React.useRef<() => Promise<void>>(async () => undefined);

  /** Wachtrij later (opnieuw) versturen, met backoff */
  const scheduleFlush = React.useCallback((delay: number) => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => void flushOutboxRef.current(), delay);
  }, []);

  // --- wachtrij versturen ---------------------------------------------------
  // Nooit stil weggooien (TECHNICAL_DESIGN §9.3.1): alleen een verwerkte of een
  // door de server geweigerde actie verdwijnt, en een weigering is zichtbaar.
  const MAX_ATTEMPTS = 5;
  const flushOutbox = React.useCallback(async (): Promise<void> => {
    if (flushing.current || outbox.current.length === 0) return;
    flushing.current = true;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    let retryLater = false;
    try {
      while (outbox.current.length) {
        const entry = outbox.current[0];
        const outcome = await sendMutation(entry.kind, entry.payload, entry.v ?? 0);

        if (outcome.type === "ok" || outcome.type === "rejected") {
          networkRetries.current = 0;
          if (outcome.type === "rejected") toast.error(rejectedMessage(entry, outcome.error), { duration: 10_000 });
          outbox.current = outbox.current.slice(1);
          await writeOutbox(outbox.current);
          updatePending();
          continue;
        }

        if (outcome.type === "auth") {
          const n = outbox.current.length;
          toast.error(`Log opnieuw in om ${n} ${n === 1 ? "wijziging" : "wijzigingen"} te versturen.`, { id: "outbox-auth" });
          break;
        }

        // Tijdelijk probleem: laten staan en later opnieuw. Offline wacht de
        // wachtrij op het "online"-signaal; online proberen we het met backoff.
        if (outcome.reason === "network" && typeof navigator !== "undefined" && !navigator.onLine) break;
        if (outcome.reason === "network") networkRetries.current += 1;
        else {
          outbox.current = [{ ...entry, attempts: entry.attempts + 1 }, ...outbox.current.slice(1)];
          await writeOutbox(outbox.current);
          if (entry.attempts + 1 >= MAX_ATTEMPTS) {
            const n = outbox.current.length;
            toast.error(`${n} ${n === 1 ? "wijziging kon" : "wijzigingen konden"} niet worden verstuurd.`, {
              id: "outbox-stuck",
              duration: Infinity,
              action: { label: "Opnieuw", onClick: () => void flushOutboxRef.current() },
            });
            break;
          }
        }
        retryLater = true;
        break;
      }
    } finally {
      flushing.current = false;
      scheduleRefresh(200);
      if (retryLater) {
        const attempts = Math.max(outbox.current[0]?.attempts ?? 0, networkRetries.current, 1);
        scheduleFlush(Math.min(60_000, 2_000 * 2 ** attempts));
      }
    }
  }, [scheduleRefresh, updatePending, rejectedMessage, scheduleFlush]);
  React.useEffect(() => {
    flushOutboxRef.current = flushOutbox;
  }, [flushOutbox]);

  // --- snelle acties ----------------------------------------------------------
  const mutate = React.useCallback(
    async <K extends MutationKind>(kind: K, payload: MutationPayload<K>): Promise<boolean> => {
      // "Ongedaan maken" van een nog niet verstuurde afvinkactie: gewoon uit de wachtrij halen
      if (kind === "undo") {
        const taskId = (payload as MutationPayload<"undo">).taskId;
        const queued = outbox.current.find(
          (e) => e.kind === "complete" && (e.payload as MutationPayload<"complete">).taskId === taskId,
        );
        if (queued) {
          outbox.current = outbox.current.filter((e) => e !== queued);
          await writeOutbox(outbox.current);
          updatePending();
          setSnapshot((s) => applyOptimistic(s, "undo", payload, ctx()));
          return true;
        }
      }

      if (kind === "complete") ownMutationIds.current.add((payload as MutationPayload<"complete">).mutationId);

      const entry: OutboxEntry = {
        id: newId(),
        v: OUTBOX_VERSION,
        kind,
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
      };
      setSnapshot((s) => applyOptimistic(s, kind, payload, ctx()));

      const queue = async (reason: "offline" | "retry" = "offline") => {
        outbox.current = [...outbox.current, entry];
        await writeOutbox(outbox.current);
        updatePending();
        if (reason === "offline") {
          toast("Opgeslagen op dit apparaat", { description: "Wordt verstuurd zodra je weer online bent." });
        } else {
          toast("Opgeslagen op dit apparaat", { description: "Versturen lukte niet meteen; de app probeert het zo opnieuw." });
          scheduleFlush(2_000);
        }
        return true;
      };

      if (typeof navigator !== "undefined" && !navigator.onLine && isOfflineCapable(kind)) return queue();

      inFlight.current.set(entry.id, entry);
      updatePending();
      const outcome = await sendMutation(kind, payload);
      inFlight.current.delete(entry.id);
      updatePending();
      switch (outcome.type) {
        case "ok":
          scheduleRefresh();
          return true;
        case "rejected":
          toast.error(outcome.error);
          scheduleRefresh(0);
          return false;
        case "auth":
          if (isOfflineCapable(kind)) {
            outbox.current = [...outbox.current, entry];
            await writeOutbox(outbox.current);
            updatePending();
            toast.error("Je bent niet meer ingelogd. Log opnieuw in om je wijziging te versturen.", { id: "outbox-auth" });
            return true;
          }
          toast.error("Je bent niet meer ingelogd. Log opnieuw in.");
          scheduleRefresh(0);
          return false;
        case "retry":
          if (isOfflineCapable(kind)) {
            const offline = outcome.reason === "network" && typeof navigator !== "undefined" && !navigator.onLine;
            return queue(offline ? "offline" : "retry");
          }
          toast.error(outcome.reason === "network" ? "Geen verbinding. Probeer het opnieuw." : "Er ging iets mis. Probeer het opnieuw.");
          scheduleRefresh(0);
          return false;
      }
    },
    [ctx, scheduleRefresh, updatePending, scheduleFlush],
  );

  const run = React.useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>, options?: { success?: string }): Promise<T | null> => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error);
          return null;
        }
        if (options?.success) toast.success(options.success);
        scheduleRefresh(100);
        return result.data;
      } catch (error) {
        toast.error(isNetworkError(error) ? "Je bent offline. Deze actie kan alleen online." : "Er ging iets mis.");
        return null;
      }
    },
    [scheduleRefresh],
  );

  // --- opstarten: cache + wachtrij -----------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cached, queued] = await Promise.all([readCachedSnapshot(householdId), readOutbox()]);
      if (cancelled) return;
      outbox.current = queued;
      updatePending();
      // Offline geopende (gecachte) pagina kan ouder zijn dan wat in IndexedDB staat
      if (cached && cached.loadedAt > initial.loadedAt) setSnapshot(reapplyPending(cached));
      else if (queued.length) setSnapshot((s) => reapplyPending(s));
      if (navigator.onLine) void flushOutbox();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij opstarten
  }, [householdId]);

  // Laatste stand bewaren voor offline gebruik
  React.useEffect(() => {
    const timer = setTimeout(() => void writeCachedSnapshot(snapshot), 800);
    return () => clearTimeout(timer);
  }, [snapshot]);

  // --- online/offline + terugkomen in de app ---------------------------------------
  React.useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void flushOutbox();
        scheduleRefresh(300);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 30_000) scheduleRefresh(0);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flushOutbox, scheduleRefresh]);

  // --- realtime: wijzigingen van andere gezinsleden ----------------------------------
  React.useEffect(() => {
    const db = getBrowserClient();
    let channel = db.channel(`household:${householdId}`);
    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (table === "task_completions" && payload.eventType === "INSERT") {
            const completion = payload.new as CompletionRow;
            if (!completion.client_mutation_id || !ownMutationIds.current.has(completion.client_mutation_id)) {
              // Zonder naam: de app legt niet vast wie afvinkte (V-21)
              toast(`${completion.title} is gedaan`, { icon: "✅" });
            }
          }
          scheduleRefresh();
        },
      );
    }
    channel = channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `member_id=eq.${meId}` },
      (payload) => {
        const n = payload.new as NotificationRow;
        if (n.type !== "task_completed") toast(n.title, { description: n.body ?? undefined, icon: "🔔" });
        scheduleRefresh();
      },
    );
    channel.subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [householdId, meId, scheduleRefresh]);

  const value = React.useMemo<HouseholdStore>(
    () => ({ snapshot, online, pending, refresh, mutate, run }),
    [snapshot, online, pending, refresh, mutate, run],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

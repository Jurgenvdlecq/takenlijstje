"use client";

import * as React from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { ShoppingCategory } from "@/types/database";
import { rankSuggestions, type ShoppingSuggestion } from "./parse";

type HistoryItem = { name: string; category: ShoppingCategory };

/**
 * "Vaak gekocht": eenmalig de eerder gekochte producten ophalen en tellen.
 * Fouten (bijv. offline) worden stil genegeerd – dan zijn er gewoon geen suggesties.
 */
export function useShoppingSuggestions(householdId: string, currentNames: string[], limit = 10): ShoppingSuggestion[] {
  const [history, setHistory] = React.useState<HistoryItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await getBrowserClient()
          .from("shopping_items")
          .select("name, category")
          .eq("household_id", householdId)
          .eq("is_bought", true)
          .order("created_at", { ascending: false })
          .limit(300);
        if (!cancelled && !error && data) setHistory(data as HistoryItem[]);
      } catch {
        // offline of geen verbinding: geen suggesties
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const key = currentNames.join("\u0000");
  return React.useMemo(
    () => rankSuggestions(history, key ? key.split("\u0000") : [], limit),
    [history, key, limit],
  );
}

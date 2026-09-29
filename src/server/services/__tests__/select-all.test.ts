import { describe, expect, it, vi } from "vitest";

/**
 * WP3 — gepagineerd lezen (DECISIONS D-040; code-review WP3, doorgeven (c)):
 * Supabase geeft standaard hooguit 1000 rijen; selectAll moet alles ophalen.
 */
vi.mock("server-only", () => ({}));

import { selectAll } from "../scheduling";

/** Nep-bron met `total` rijen die per aanroep het gevraagde bereik (inclusief) teruggeeft, zoals .range() */
function bron(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to, 999_999) + 1).slice(0, 1000), error: null };
  };
  return { page, calls };
}

describe("selectAll", () => {
  it("haalt 2500 rijen op in drie pagina's van 1000", async () => {
    const { page, calls } = bron(2500);
    const all = await selectAll(page);
    expect(all).toHaveLength(2500);
    expect(new Set(all.map((r) => r.id)).size).toBe(2500);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("precies 1000 rijen: vraagt nog één (lege) pagina en stopt dan", async () => {
    const { page, calls } = bron(1000);
    expect(await selectAll(page)).toHaveLength(1000);
    expect(calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("minder dan 1000: één pagina", async () => {
    const { page, calls } = bron(3);
    expect(await selectAll(page)).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it("een databasefout halverwege gooit, in plaats van een halve lijst terug te geven", async () => {
    let n = 0;
    const page = async () => (n++ === 0 ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null } : { data: null, error: { code: "57014", message: "time-out" } });
    await expect(selectAll(page)).rejects.toBeTruthy();
  });
});

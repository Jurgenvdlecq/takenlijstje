import { describe, expect, it } from "vitest";
import { migrateOutboxEntry, OUTBOX_KINDS, OUTBOX_VERSION } from "../migrate";

const vasteId = () => "00000000-0000-4000-8000-000000000001";

describe("migrateOutboxEntry (TECHNICAL_DESIGN §9.3.1, AC-172)", () => {
  it("zet een v0-afvinking (zonder versie, met het vervallen completedBy) om, en gooit hem niet weg", () => {
    const payload = { taskId: "t1", mutationId: "m1", completedAt: "2026-09-28T08:00:00Z", completedBy: "lid-kai" };
    const result = migrateOutboxEntry(undefined, "complete", payload, vasteId);
    expect(result).toEqual({ status: "ok", kind: "complete", payload });
  });

  it("behandelt een expliciete versie 0 hetzelfde als een ontbrekende versie", () => {
    expect(migrateOutboxEntry(0, "undo", { taskId: "t1" }, vasteId)).toEqual({ status: "ok", kind: "undo", payload: { taskId: "t1" } });
  });

  it("laat een entry van de huidige versie ongewijzigd", () => {
    const payload = { id: "b1", name: "Melk" };
    expect(migrateOutboxEntry(OUTBOX_VERSION, "shoppingAdd", payload, vasteId)).toEqual({ status: "ok", kind: "shoppingAdd", payload });
  });

  it("geeft een v0-boodschap zonder id alsnog een eigen id (idempotent opnieuw versturen)", () => {
    const result = migrateOutboxEntry(undefined, "shoppingAdd", { name: "Melk" }, vasteId);
    expect(result).toEqual({ status: "ok", kind: "shoppingAdd", payload: { name: "Melk", id: vasteId() } });
  });

  it("wijzigt de payload van de aanroeper niet", () => {
    const payload = { name: "Melk" };
    migrateOutboxEntry(0, "shoppingAdd", payload, vasteId);
    expect(payload).toEqual({ name: "Melk" });
  });

  it("geeft een v1-boodschap zonder id geen nieuwe id (alleen v0 wordt aangevuld)", () => {
    expect(migrateOutboxEntry(1, "shoppingAdd", { name: "Melk" }, vasteId)).toEqual({
      status: "ok",
      kind: "shoppingAdd",
      payload: { name: "Melk" },
    });
  });

  it("geeft 'future' voor een versie die nieuwer is dan deze server (laten staan, later opnieuw)", () => {
    expect(migrateOutboxEntry(OUTBOX_VERSION + 1, "complete", { taskId: "t1" }, vasteId)).toEqual({ status: "future" });
  });

  it("geeft 'obsolete' met de soortnaam voor een soort die niet meer bestaat", () => {
    expect(migrateOutboxEntry(0, "swapRequest", { taskId: "t1" }, vasteId)).toEqual({
      status: "obsolete",
      kind: "swapRequest",
      label: "swapRequest",
    });
  });

  it("behandelt '__proto__' en andere Object-eigenschappen als onbekende soort, niet als handler", () => {
    for (const kind of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      const result = migrateOutboxEntry(1, kind, { taskId: "t1" }, vasteId);
      expect(result.status).toBe("obsolete");
    }
  });

  it("weigert een ongeldige versie, soort of payload als 'invalid'", () => {
    expect(migrateOutboxEntry(-1, "complete", {}, vasteId).status).toBe("invalid");
    expect(migrateOutboxEntry(1.5, "complete", {}, vasteId).status).toBe("invalid");
    expect(migrateOutboxEntry(1, "", {}, vasteId).status).toBe("invalid");
    expect(migrateOutboxEntry(1, 42, {}, vasteId).status).toBe("invalid");
    expect(migrateOutboxEntry(1, "complete", null, vasteId).status).toBe("invalid");
    expect(migrateOutboxEntry(1, "complete", ["t1"], vasteId).status).toBe("invalid");
    expect(migrateOutboxEntry(1, "complete", "t1", vasteId).status).toBe("invalid");
  });

  it("kent elke soort uit OUTBOX_KINDS", () => {
    for (const kind of OUTBOX_KINDS) {
      expect(migrateOutboxEntry(OUTBOX_VERSION, kind, {}, vasteId).status).toBe("ok");
    }
  });
});

"use client";

/** Kleine bouwstenen van Instellingen › Afvalkalender (oude UI, WP3b). */
import * as React from "react";
import { formatWasteDay, WASTE_TEXT } from "@/domain/waste/messages";
import type { WasteStream } from "@/domain/waste/streams";

export interface FormValues {
  postcode: string;
  houseNumber: string;
  suffix: string;
}

const TIP_KEY = "takenlijstje:afval-tip-gezien";

/** Bold-stukken (T-40, T-46) als afwisselend gewone en vette tekst */
export function Emphasis({ parts }: { parts: readonly string[] }) {
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {part}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export function readTipSeen(): boolean {
  try {
    return window.localStorage.getItem(TIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTipSeen() {
  try {
    window.localStorage.setItem(TIP_KEY, "1");
  } catch {
    // alleen gemak; zonder opslag komt de tip gewoon terug
  }
}

export function OfflineHint({ online }: { online: boolean }) {
  if (online) return null;
  return <p className="text-sm text-muted-foreground">{WASTE_TEXT.offline}</p>;
}

export function PickupRow({ stream, date }: { stream: WasteStream; date: string | null }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <dt className="text-muted-foreground">{WASTE_TEXT.streamLabels[stream]}</dt>
      <dd className={date ? "font-medium" : "text-muted-foreground"}>{date ? formatWasteDay(date) : WASTE_TEXT.noDateKnown}</dd>
    </div>
  );
}

/**
 * Snelle invoer: "Badkamer zaterdag Jurgen" → taak + datum + persoon.
 *
 * Herkent (Nederlands):
 *  - datums:   vandaag, morgen, overmorgen, maandag…zondag (ma…zo),
 *              "volgende week", "volgende zaterdag", 12-10, 12/10, 12 okt(ober)
 *  - tijden:   18:00, 18.30, 18u, "om 18 uur"
 *  - personen: voornaam van een gezinslid, ook "@ellen" of "voor Ellen"
 *  - prioriteit: "!", "!!", "urgent", "belangrijk"
 *  - herhaling: dagelijks, elke dag, wekelijks, elke week, elke zaterdag,
 *              elke 2 weken, om de week, maandelijks
 *  - standaardtaken: "badkamer" → "Badkamer schoonmaken"
 *
 * Bewust simpel en voorspelbaar; later kan hier een AI/NLP-parser achter.
 */
import { addDays, isISODate, isoWeekday, makeDate, parts, type ISODate } from "../dates";
import type { RecurrenceRule } from "../recurrence/rule";
import type { Priority } from "../status";

export interface QuickAddMember {
  id: string;
  displayName: string;
}

export interface QuickAddTemplate {
  id: string;
  title: string;
  keywords: string[];
}

export interface QuickAddResult {
  title: string;
  date: ISODate | null;
  time: string | null;
  memberId: string | null;
  priority: Priority | null;
  rule: RecurrenceRule | null;
  templateId: string | null;
}

const WEEKDAYS: Record<string, number> = {
  maandag: 1, ma: 1, dinsdag: 2, di: 2, woensdag: 3, wo: 3, donderdag: 4, do: 4,
  vrijdag: 5, vr: 5, zaterdag: 6, za: 6, zondag: 7, zo: 7,
};

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mrt: 3, maart: 3, apr: 4, april: 4, mei: 5,
  jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, augustus: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const FILLER = new Set(["om", "op", "voor", "uur", "door", "en", "de", "het", "a.s.", "as", "aanstaande"]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function nextWeekday(today: ISODate, weekday: number, skipWeek = false): ISODate {
  let diff = (weekday - isoWeekday(today) + 7) % 7;
  if (skipWeek) diff += 7;
  return addDays(today, diff);
}

/** Dag/maand zonder jaar: dit jaar, of volgend jaar als de datum al voorbij is. */
function upcomingDate(today: ISODate, day: number, month: number): ISODate | null {
  const { year } = parts(today);
  for (const y of [year, year + 1]) {
    const candidate = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isISODate(candidate) && candidate >= today) return candidate;
  }
  return null;
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function toTime(h: number, m = 0): string | null {
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseQuickAdd(
  input: string,
  context: { today: ISODate; members: QuickAddMember[]; templates?: QuickAddTemplate[] },
): QuickAddResult {
  const { today } = context;
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const used = new Array(tokens.length).fill(false);
  const norm = tokens.map(normalize);

  const result: QuickAddResult = {
    title: "",
    date: null,
    time: null,
    memberId: null,
    priority: null,
    rule: null,
    templateId: null,
  };

  const firstNames = context.members.map((m) => ({
    id: m.id,
    name: normalize(m.displayName.split(/\s+/)[0] ?? m.displayName),
  }));

  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const t = norm[i].replace(/[,.]$/, "");
    const next = norm[i + 1]?.replace(/[,.]$/, "");

    // --- herhaling -------------------------------------------------------
    if (t === "dagelijks" || (t === "elke" && next === "dag")) {
      result.rule = { freq: "daily", interval: 1 };
      used[i] = true;
      if (t === "elke") used[i + 1] = true;
      continue;
    }
    if (t === "wekelijks" || (t === "elke" && next === "week") || (t === "om" && next === "de" && norm[i + 2] === "week")) {
      const weekday = result.date ? isoWeekday(result.date) : isoWeekday(today);
      result.rule = { freq: "weekly", interval: t === "om" ? 2 : 1, weekdays: [weekday] };
      used[i] = used[i + 1] = true;
      if (t === "om") used[i + 2] = true;
      continue;
    }
    if (t === "maandelijks" || (t === "elke" && next === "maand")) {
      result.rule = { freq: "monthly", interval: 1, monthDay: parts(result.date ?? today).day };
      used[i] = true;
      if (t === "elke") used[i + 1] = true;
      continue;
    }
    if (t === "elke" && next && /^\d+$/.test(next) && norm[i + 2]?.startsWith("we")) {
      const weekday = result.date ? isoWeekday(result.date) : isoWeekday(today);
      result.rule = { freq: "weekly", interval: Math.min(52, Number(next)), weekdays: [weekday] };
      used[i] = used[i + 1] = used[i + 2] = true;
      continue;
    }
    if (t === "elke" && next && WEEKDAYS[next] && next.length > 2) {
      const weekday = WEEKDAYS[next];
      if (result.rule?.freq === "weekly") {
        result.rule = { ...result.rule, weekdays: [...new Set([...result.rule.weekdays, weekday])].sort() };
      } else {
        result.rule = { freq: "weekly", interval: 1, weekdays: [weekday] };
      }
      result.date ??= nextWeekday(today, weekday);
      used[i] = used[i + 1] = true;
      continue;
    }

    // --- datums ----------------------------------------------------------
    if (t === "vandaag") { result.date = today; used[i] = true; continue; }
    if (t === "morgen") { result.date = addDays(today, 1); used[i] = true; continue; }
    if (t === "overmorgen") { result.date = addDays(today, 2); used[i] = true; continue; }
    if (t === "volgende" && next === "week") {
      result.date = nextWeekday(today, 1, true);
      used[i] = used[i + 1] = true;
      continue;
    }
    if (t === "volgende" && next && WEEKDAYS[next]) {
      result.date = nextWeekday(today, WEEKDAYS[next], nextWeekday(today, WEEKDAYS[next]) === today);
      used[i] = used[i + 1] = true;
      continue;
    }
    if (WEEKDAYS[t] !== undefined) {
      result.date = nextWeekday(today, WEEKDAYS[t]);
      used[i] = true;
      continue;
    }
    const dm = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/.exec(t);
    if (dm) {
      const day = Number(dm[1]);
      const month = Number(dm[2]);
      let date: ISODate | null;
      if (dm[3]) {
        const year = dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3]);
        const candidate = makeDate(year, month, day);
        date = candidate === `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` ? candidate : null;
      } else {
        date = upcomingDate(today, day, month);
      }
      if (date) { result.date = date; used[i] = true; continue; }
    }
    if (/^\d{1,2}$/.test(t) && next && MONTHS[next]) {
      const date = upcomingDate(today, Number(t), MONTHS[next]);
      if (date) { result.date = date; used[i] = used[i + 1] = true; continue; }
    }

    // --- tijden ----------------------------------------------------------
    const hm = /^(\d{1,2})[:.](\d{2})(?:u(?:ur)?)?$/.exec(t);
    if (hm) {
      const time = toTime(Number(hm[1]), Number(hm[2]));
      if (time) {
        result.time = time;
        used[i] = true;
        if (i > 0 && norm[i - 1] === "om") used[i - 1] = true;
        continue;
      }
    }
    const hOnly = /^(\d{1,2})u(?:ur)?$/.exec(t);
    if (hOnly || (/^\d{1,2}$/.test(t) && (next === "uur" || norm[i - 1] === "om"))) {
      const time = toTime(Number(hOnly ? hOnly[1] : t));
      if (time) {
        result.time = time;
        used[i] = true;
        if (next === "uur") used[i + 1] = true;
        if (i > 0 && norm[i - 1] === "om") used[i - 1] = true;
        continue;
      }
    }

    // --- prioriteit ------------------------------------------------------
    if (t === "!!" || t === "urgent" || t === "!urgent") { result.priority = "urgent"; used[i] = true; continue; }
    if (t === "!" || t === "belangrijk" || t === "!hoog" || t === "hoog") { result.priority = "high"; used[i] = true; continue; }

    // --- personen --------------------------------------------------------
    const name = t.replace(/^@/, "");
    const member = firstNames.find((m) => m.name === name);
    if (member) {
      result.memberId = member.id;
      used[i] = true;
      if (i > 0 && (norm[i - 1] === "voor" || norm[i - 1] === "door")) used[i - 1] = true;
      continue;
    }
  }

  // Resterende woorden vormen de titel (vulwoorden aan de randen weglaten)
  const rest = tokens.filter((_, i) => !used[i]);
  while (rest.length && FILLER.has(normalize(rest[0]))) rest.shift();
  while (rest.length && FILLER.has(normalize(rest[rest.length - 1]))) rest.pop();
  const typed = rest.join(" ");

  const template = matchTemplate(typed, context.templates ?? []);
  if (template) {
    result.title = template.title;
    result.templateId = template.id;
  } else {
    result.title = capitalize(typed);
  }

  return result;
}

/** "badkamer" → "Badkamer schoonmaken"; "wc" → "WC schoonmaken". */
export function matchTemplate(text: string, templates: QuickAddTemplate[]): QuickAddTemplate | null {
  const needle = normalize(text);
  if (!needle) return null;
  return (
    templates.find((t) => normalize(t.title) === needle) ??
    templates.find((t) => t.keywords.some((k) => normalize(k) === needle)) ??
    templates.find((t) => normalize(t.title).startsWith(needle) && needle.length >= 4) ??
    null
  );
}

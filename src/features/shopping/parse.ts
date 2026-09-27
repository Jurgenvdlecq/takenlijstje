/**
 * Pure logica voor de boodschappenlijst: snelle invoer ontleden
 * ("2 melk", "melk 2x", "1 kg appels"), een categorie raden en
 * "vaak gekocht"-suggesties berekenen. Geen React, dus goed te testen.
 */
import type { ShoppingCategory } from "@/types/database";

/** Volgorde waarin de categorieën op de lijst staan (looproute door de winkel) */
export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  "produce",
  "meat",
  "dairy",
  "bread",
  "drinks",
  "frozen",
  "drugstore",
  "household",
  "other",
];

export interface ParsedShoppingInput {
  name: string;
  quantity: string | null;
}

/** Eenheden en verpakkingen die bij een hoeveelheid horen ("3 pakken", "1 kg") */
const UNITS = [
  "kg", "kilo", "g", "gr", "gram", "ons", "l", "liter", "ltr", "ml", "cl", "dl",
  "st", "stuk", "stuks", "pak", "pakken", "pakje", "pakjes", "fles", "flessen", "flesje", "flesjes",
  "blik", "blikken", "blikje", "blikjes", "zak", "zakken", "zakje", "zakjes", "doos", "dozen", "doosje", "doosjes",
  "bak", "bakken", "bakje", "bakjes", "pot", "potten", "potje", "potjes", "krat", "kratten",
  "tros", "trossen", "bos", "bossen", "bosje", "bosjes", "rol", "rollen", "net", "netjes", "netje",
  "tube", "tubes", "brood", "broden", "plak", "plakken", "stronk", "stronken",
];
const UNIT_SET = new Set(UNITS);
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;

/** Eerste letter als hoofdletter, rest zoals ingetypt */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Ontleedt een snelle invoer in naam + hoeveelheid.
 *  - "2 melk" → { name: "Melk", quantity: "2" }
 *  - "melk 2x" / "melk x2" → { name: "Melk", quantity: "2" }
 *  - "1 kg appels" → { name: "Appels", quantity: "1 kg" }
 *  - "3 pakken melk" → { name: "Melk", quantity: "3 pakken" }
 *  - "gehakt 500 gram" → { name: "Gehakt", quantity: "500 gram" }
 */
export function parseShoppingInput(raw: string): ParsedShoppingInput {
  const text = clean(raw);
  if (!text) return { name: "", quantity: null };

  // Voorloop: "2x melk", "2 melk", "1,5 kg appels", "3 pakken melk"
  const leading = text.match(new RegExp(String.raw`^(${NUMBER})\s*x?\s+(.+)$`, "i"));
  if (leading) {
    const amount = leading[1];
    const rest = leading[2];
    const [firstWord, ...others] = rest.split(" ");
    if (others.length && UNIT_SET.has(firstWord.toLowerCase())) {
      return { name: capitalize(others.join(" ")), quantity: `${amount} ${firstWord}` };
    }
    return { name: capitalize(rest), quantity: amount };
  }

  // Direct aan elkaar: "500g gehakt", "2kg aardappels"
  const glued = text.match(new RegExp(String.raw`^(${NUMBER})([a-z]+)\s+(.+)$`, "i"));
  if (glued && UNIT_SET.has(glued[2].toLowerCase())) {
    return { name: capitalize(glued[3]), quantity: `${glued[1]} ${glued[2]}` };
  }

  // Achteraan: "melk 2x", "melk x2", "melk 2"
  const trailingTimes = text.match(new RegExp(String.raw`^(.+?)\s+(?:(${NUMBER})\s*x|x\s*(${NUMBER})|(${NUMBER}))$`, "i"));
  if (trailingTimes) {
    return { name: capitalize(trailingTimes[1]), quantity: trailingTimes[2] ?? trailingTimes[3] ?? trailingTimes[4] };
  }

  // Achteraan met eenheid: "gehakt 500 gram", "cola 2 flessen"
  const trailingUnit = text.match(new RegExp(String.raw`^(.+?)\s+(${NUMBER})\s*([a-z]+)$`, "i"));
  if (trailingUnit && UNIT_SET.has(trailingUnit[3].toLowerCase())) {
    return { name: capitalize(trailingUnit[1]), quantity: `${trailingUnit[2]} ${trailingUnit[3]}` };
  }

  return { name: capitalize(text), quantity: null };
}

/**
 * Trefwoorden per categorie. Er wordt gezocht op "komt voor in de naam";
 * bij meerdere treffers wint het langste trefwoord ("appelsap" → dranken,
 * "ijsbergsla" → groente, "rijst" → overig).
 */
const KEYWORDS: Record<ShoppingCategory, string[]> = {
  produce: [
    "appel", "banaan", "banan", "tomaat", "tomat", "sla", "ijsbergsla", "komkommer", "paprika", "ui", "uien",
    "knoflook", "wortel", "aardappel", "peer", "peren", "druif", "druiven", "sinaasappel", "mandarijn", "citroen",
    "limoen", "aardbei", "framboos", "frambozen", "blauwe bes", "bessen", "meloen", "watermeloen", "avocado",
    "courgette", "broccoli", "bloemkool", "spinazie", "prei", "champignon", "paddenstoel", "boon", "bonen",
    "sperzieboon", "kiwi", "mango", "ananas", "groente", "fruit", "rucola", "andijvie", "spruit", "biet", "radijs",
  ],
  meat: [
    "kip", "gehakt", "vis", "zalm", "tonijn", "kabeljauw", "garnaal", "garnalen", "biefstuk", "karbonade", "worst",
    "spek", "spekjes", "ham", "vlees", "hamburger", "shoarma", "schnitzel", "filet", "rookworst", "salami",
    "kipfilet", "slavink", "braadworst",
  ],
  dairy: [
    "melk", "kaas", "yoghurt", "kwark", "boter", "room", "slagroom", "vla", "eieren", "eitjes", "roomboter",
    "karnemelk", "margarine", "zuivel", "creme fraiche", "crème fraîche", "mozzarella", "feta",
  ],
  bread: [
    "brood", "croissant", "bolletje", "bolletjes", "broodje", "broodjes", "stokbrood", "beschuit", "crackers",
    "krentenbol", "pistolet", "wrap", "wraps", "tijgerbrood", "volkoren",
  ],
  drinks: [
    "cola", "bier", "sap", "water", "fris", "limonade", "ranja", "wijn", "koffie", "thee", "spa rood", "spa blauw", "sinas",
    "ice tea", "icetea", "appelsap", "jus d'orange", "sinaasappelsap", "energy", "tonic", "prosecco", "chocomel",
  ],
  frozen: [
    "ijs", "diepvries", "pizza", "friet", "patat", "ijsblokjes", "waterijs", "vissticks", "kroket", "frikandel",
    "bitterbal", "bitterballen", "diepvriesgroente", "roomijs",
  ],
  drugstore: [
    "shampoo", "tandpasta", "zeep", "douchegel", "deodorant", "deo", "tandenborstel", "scheermes", "zonnebrand",
    "pleister", "pleisters", "paracetamol", "ibuprofen", "luiers", "maandverband", "tampons", "wattenschijf",
    "wattenstaafjes", "bodylotion", "conditioner", "handzeep", "crème", "creme",
  ],
  household: [
    "toiletpapier", "wc-papier", "wcpapier", "wc papier", "afwasmiddel", "wasmiddel", "vuilniszak", "vuilniszakken",
    "keukenpapier", "keukenrol", "schoonmaakmiddel", "allesreiniger", "wasverzachter", "vaatwastablet",
    "vaatwastabletten", "sponsje", "spons", "aluminiumfolie", "vershoudfolie", "bakpapier", "batterij",
    "batterijen", "lampje", "tissues", "zakdoekjes", "wc-blok", "chloor", "glasreiniger", "afvalzak",
  ],
  // Uitzonderingen: woorden die een kort trefwoord bevatten maar nergens anders horen
  other: ["rijst", "pindakaas", "hagelslag", "pasta", "spaghetti", "macaroni", "chocolade", "chips", "koekjes"],
};

const KEYWORD_LIST: { keyword: string; category: ShoppingCategory }[] = Object.entries(KEYWORDS).flatMap(
  ([category, words]) => words.map((keyword) => ({ keyword, category: category as ShoppingCategory })),
);

/** Raadt de categorie van een product aan de hand van trefwoorden. */
export function guessCategory(name: string): ShoppingCategory {
  const text = clean(name).toLowerCase();
  if (!text) return "other";
  let best: { keyword: string; category: ShoppingCategory } | null = null;
  for (const entry of KEYWORD_LIST) {
    if (!text.includes(entry.keyword)) continue;
    // Heel korte trefwoorden ("ui", "sap", "ijs") alleen als los woord of woordbegin/-einde
    if (entry.keyword.length <= 2 && !new RegExp(String.raw`(^|[^a-z])${entry.keyword}([^a-z]|$)`).test(text)) continue;
    if (!best || entry.keyword.length > best.keyword.length) best = entry;
  }
  return best?.category ?? "other";
}

export interface ShoppingSuggestion {
  name: string;
  category: ShoppingCategory;
  count: number;
}

/**
 * "Vaak gekocht": telt eerder gekochte producten (nieuwste eerst aangeleverd),
 * laat weg wat nu al op de lijst staat en geeft de top terug.
 */
export function rankSuggestions(
  history: { name: string; category: ShoppingCategory }[],
  currentNames: string[],
  limit = 10,
): ShoppingSuggestion[] {
  const onList = new Set(currentNames.map((n) => clean(n).toLowerCase()));
  const counts = new Map<string, ShoppingSuggestion & { firstSeen: number }>();
  history.forEach((item, index) => {
    const key = clean(item.name).toLowerCase();
    if (!key || onList.has(key)) return;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    // De nieuwste schrijfwijze en categorie aanhouden
    else counts.set(key, { name: clean(item.name), category: item.category, count: 1, firstSeen: index });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen)
    .slice(0, limit)
    .map(({ name, category, count }) => ({ name, category, count }));
}

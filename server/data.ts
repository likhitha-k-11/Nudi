import fs from "node:fs";
import path from "node:path";

export interface SyllableGuide {
  kn: string;
  ph: string;
  tip: string;
}

export interface PracticeItem {
  id: string | number;
  datasetId?: string;
  cat: string;
  kn: string;
  tr: string;
  en: string;
  syl: SyllableGuide[];
  isDataset?: boolean;
}

export interface DatasetEntry {
  id: string;
  kn: string;
}

export const CATEGORIES: Record<string, string> = {
  g: "Greetings",
  f: "Food",
  h: "Family",
  n: "Numbers",
  t: "Travel",
  s: "Shopping",
};

const RAW_WORDS: Array<
  [string, string, string, string, Array<[string, string, string]>]
> = [
  [
    "g",
    "ನಮಸ್ಕಾರ",
    "Namaskara",
    "Hello / Greetings",
    [
      ["ನ", "na", "Soft dental ‘n’, tongue on teeth."],
      ["ಮ", "ma", "Short ‘a’ like ‘u’ in ‘cup’."],
      ["ಸ್ಕಾ", "skaa", "Cluster: ‘s’ flows straight into ‘k’, long ‘aa’."],
      ["ರ", "ra", "Light tap of the tongue, not the English ‘r’."],
    ],
  ],
  [
    "g",
    "ಧನ್ಯವಾದಗಳು",
    "Dhanyavaadagalu",
    "Thank you",
    [
      ["ಧ", "dha", "Aspirated dental ‘d’ — a puff of breath."],
      ["ನ್ಯ", "nya", "Nasal ‘ny’, like Spanish ‘ñ’."],
      ["ವಾ", "vaa", "Long ‘aa’, soft ‘v’."],
      ["ದ", "da", "Dental ‘d’."],
      ["ಗ", "ga", "Plain ‘g’."],
      ["ಳು", "lu", "Retroflex ‘ḷ’ — curl the tongue back — then ‘u’."],
    ],
  ],
  [
    "g",
    "ಹೇಗಿದ್ದೀರಾ",
    "Hegiddira",
    "How are you?",
    [
      ["ಹೇ", "hee", "Long ‘e’ as in ‘hay’, without the glide."],
      ["ಗಿ", "gi", "Short ‘i’."],
      ["ದ್ದೀ", "ddee", "Doubled ‘d’: hold it, then long ‘ee’."],
      ["ರಾ", "raa", "Tapped ‘r’, long ‘aa’."],
    ],
  ],
  [
    "g",
    "ದಯವಿಟ್ಟು",
    "Dayavittu",
    "Please",
    [
      ["ದ", "da", "Dental ‘d’."],
      ["ಯ", "ya", "Clear ‘y’."],
      ["ವಿ", "vi", "Soft ‘v’, short ‘i’."],
      ["ಟ್ಟು", "ttu", "Retroflex ‘ṭ’, held long."],
    ],
  ],
  [
    "f",
    "ನೀರು",
    "Neeru",
    "Water",
    [
      ["ನೀ", "nee", "Long ‘ee’."],
      ["ರು", "ru", "Tapped ‘r’ + short ‘u’."],
    ],
  ],
  [
    "f",
    "ಊಟ",
    "Oota",
    "Food / Meal",
    [
      ["ಊ", "oo", "Long ‘oo’ as in ‘pool’."],
      ["ಟ", "ṭa", "Retroflex ‘ṭ’ — tongue tip curls back."],
    ],
  ],
  [
    "f",
    "ಅನ್ನ",
    "Anna",
    "Cooked rice",
    [
      ["ಅ", "a", "Short ‘a’."],
      ["ನ್ನ", "nna", "Held, doubled ‘n’."],
    ],
  ],
  [
    "f",
    "ಕಾಫಿ",
    "Kaaphi",
    "Coffee",
    [
      ["ಕಾ", "kaa", "Long ‘aa’."],
      ["ಫಿ", "phi", "‘f’-like ‘ph’, short ‘i’."],
    ],
  ],
  [
    "h",
    "ಮನೆ",
    "Mane",
    "House",
    [
      ["ಮ", "ma", "Short ‘a’."],
      ["ನೆ", "ne", "Short ‘e’ as in ‘net’."],
    ],
  ],
  [
    "h",
    "ಅಮ್ಮ",
    "Amma",
    "Mother",
    [
      ["ಅ", "a", "Short ‘a’."],
      ["ಮ್ಮ", "mma", "Held, doubled ‘m’."],
    ],
  ],
  [
    "h",
    "ಅಪ್ಪ",
    "Appa",
    "Father",
    [
      ["ಅ", "a", "Short ‘a’."],
      ["ಪ್ಪ", "ppa", "Held, doubled ‘p’ without a puff."],
    ],
  ],
  [
    "n",
    "ಒಂದು",
    "Ondu",
    "One",
    [
      ["ಒಂ", "om", "Short ‘o’ then nasal ‘m/n’."],
      ["ದು", "du", "Dental ‘d’ + short ‘u’."],
    ],
  ],
  [
    "n",
    "ಎರಡು",
    "Eradu",
    "Two",
    [
      ["ಎ", "e", "Short ‘e’."],
      ["ರ", "ra", "Tapped ‘r’."],
      ["ಡು", "ḍu", "Retroflex ‘ḍ’ + short ‘u’."],
    ],
  ],
  [
    "t",
    "ಎಲ್ಲಿ",
    "Elli",
    "Where?",
    [
      ["ಎ", "e", "Short ‘e’."],
      ["ಲ್ಲಿ", "lli", "Held, doubled ‘l’, short ‘i’."],
    ],
  ],
  [
    "s",
    "ಬೆಲೆ ಎಷ್ಟು",
    "Bele eshtu",
    "How much?",
    [
      ["ಬೆ", "be", "Short ‘e’."],
      ["ಲೆ", "le", "Short ‘e’."],
      ["ಎ", "e", "Short ‘e’."],
      ["ಷ್ಟು", "shtu", "Retroflex ‘sh’ into ‘ṭ’."],
    ],
  ],
];

export const WORDS: PracticeItem[] = RAW_WORDS.map((w, i) => ({
  id: i,
  cat: w[0],
  kn: w[1],
  tr: w[2],
  en: w[3],
  syl: w[4].map((s) => ({ kn: s[0], ph: s[1], tip: s[2] })),
  isDataset: false,
}));

const VOWELS: Record<string, string> = {
  "\u0C85": "a",
  "\u0C86": "aa",
  "\u0C87": "i",
  "\u0C88": "ee",
  "\u0C89": "u",
  "\u0C8A": "oo",
  "\u0C8B": "ru",
  "\u0C8E": "e",
  "\u0C8F": "ee",
  "\u0C90": "ai",
  "\u0C92": "o",
  "\u0C93": "oo",
  "\u0C94": "au",
};

const MATRAS: Record<string, string> = {
  "\u0CBE": "aa",
  "\u0CBF": "i",
  "\u0CC0": "ee",
  "\u0CC1": "u",
  "\u0CC2": "oo",
  "\u0CC3": "ru",
  "\u0CC4": "roo",
  "\u0CC6": "e",
  "\u0CC7": "ee",
  "\u0CC8": "ai",
  "\u0CCA": "o",
  "\u0CCB": "oo",
  "\u0CCC": "au",
};

const CONSONANTS: Record<string, string> = {
  "\u0C95": "k",
  "\u0C96": "kh",
  "\u0C97": "g",
  "\u0C98": "gh",
  "\u0C99": "ng",
  "\u0C9A": "ch",
  "\u0C9B": "chh",
  "\u0C9C": "j",
  "\u0C9D": "jh",
  "\u0C9E": "ny",
  "\u0C9F": "t",
  "\u0CA0": "th",
  "\u0CA1": "d",
  "\u0CA2": "dh",
  "\u0CA3": "n",
  "\u0CA4": "t",
  "\u0CA5": "th",
  "\u0CA6": "d",
  "\u0CA7": "dh",
  "\u0CA8": "n",
  "\u0CAA": "p",
  "\u0CAB": "ph",
  "\u0CAC": "b",
  "\u0CAD": "bh",
  "\u0CAE": "m",
  "\u0CAF": "y",
  "\u0CB0": "r",
  "\u0CB1": "r",
  "\u0CB2": "l",
  "\u0CB3": "l",
  "\u0CB5": "v",
  "\u0CB6": "sh",
  "\u0CB7": "sh",
  "\u0CB8": "s",
  "\u0CB9": "h",
  "\u0CDE": "l",
};

const VIRAMA = "\u0CCD";
const ANUSVARA = "\u0C82";
const VISARGA = "\u0C83";
const NUKTA = "\u0CBC";

function isKannadaConsonant(ch: string): boolean {
  return Boolean(CONSONANTS[ch]);
}

function isKannadaVowel(ch: string): boolean {
  return Boolean(VOWELS[ch]);
}

function isMatra(ch: string): boolean {
  return Boolean(MATRAS[ch]);
}

export function splitKannadaAksharas(text: string): string[] {
  const chars = Array.from(text.trim());
  const out: string[] = [];
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];
    if (/\s/.test(ch) || /[.,!?'"“”‘’()[\]{};:\-–—]/.test(ch)) {
      i++;
      continue;
    }

    if (isKannadaConsonant(ch)) {
      let cluster = ch;
      i++;
      if (chars[i] === NUKTA) {
        cluster += chars[i];
        i++;
      }
      while (chars[i] === VIRAMA && i + 1 < chars.length && isKannadaConsonant(chars[i + 1])) {
        cluster += chars[i] + chars[i + 1];
        i += 2;
        if (chars[i] === NUKTA) {
          cluster += chars[i];
          i++;
        }
      }
      if (chars[i] === VIRAMA) {
        cluster += chars[i];
        i++;
      } else if (i < chars.length && isMatra(chars[i])) {
        cluster += chars[i];
        i++;
      }
      if (chars[i] === ANUSVARA || chars[i] === VISARGA) {
        cluster += chars[i];
        i++;
      }
      out.push(cluster);
      continue;
    }

    if (isKannadaVowel(ch)) {
      let cluster = ch;
      i++;
      if (chars[i] === ANUSVARA || chars[i] === VISARGA) {
        cluster += chars[i];
        i++;
      }
      out.push(cluster);
      continue;
    }

    // Fallback for digits/Latin/unrecognized Kannada marks
    out.push(ch);
    i++;
  }

  return out;
}

export function transliterateKannada(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens
    .map((word) => {
      const aksharas = splitKannadaAksharas(word);
      return aksharas.map((ak) => transliterateAkshara(ak)).join("");
    })
    .join(" ");
}

function transliterateAkshara(ak: string): string {
  const chars = Array.from(ak);
  let res = "";
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];
    if (VOWELS[ch]) {
      res += VOWELS[ch];
      i++;
    } else if (CONSONANTS[ch]) {
      res += CONSONANTS[ch];
      i++;
      if (chars[i] === NUKTA) i++;
      if (chars[i] === VIRAMA) {
        i++;
      } else if (i < chars.length && MATRAS[chars[i]]) {
        res += MATRAS[chars[i]];
        i++;
      } else {
        res += "a";
      }
    } else if (ch === ANUSVARA) {
      res += "m";
      i++;
    } else if (ch === VISARGA) {
      res += "ha";
      i++;
    } else {
      res += ch;
      i++;
    }
  }
  return res;
}

export function buildDatasetPracticeItem(entry: DatasetEntry): PracticeItem {
  const words = entry.kn
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?'"“”‘’()[\]{};:\-–—]/g, ""))
    .filter(Boolean);
  const aksharas = splitKannadaAksharas(entry.kn);

  const units = aksharas.length <= 14 ? aksharas : words;
  const syl: SyllableGuide[] = units.map((unit) => ({
    kn: unit,
    ph: transliterateKannada(unit) || unit,
    tip:
      aksharas.length <= 14
        ? `Pronounce “${unit}” (${transliterateKannada(unit) || unit}) cleanly and check vowel length.`
        : `Focus on speaking “${unit}” (${transliterateKannada(unit) || unit}) smoothly within the sentence.`,
  }));

  return {
    id: `ds:${entry.id}`,
    datasetId: entry.id,
    cat: "dataset",
    kn: entry.kn,
    tr: transliterateKannada(entry.kn),
    en: `OpenSLR-79 corpus · ${entry.id}`,
    syl,
    isDataset: true,
  };
}

export const DATASET_RELATIVE_PATH = path.join(
  "public",
  "assets",
  "aistudio",
  "line_index_male_8608efbb.tsv"
);

let cachedDataset: DatasetEntry[] | null = null;
let datasetLoadError: string | null = null;

export function loadOpenSlrDataset(): {
  entries: DatasetEntry[];
  error: string | null;
  filePath: string;
} {
  const fullPath = path.resolve(process.cwd(), DATASET_RELATIVE_PATH);
  if (cachedDataset !== null) {
    return { entries: cachedDataset, error: datasetLoadError, filePath: fullPath };
  }

  try {
    if (!fs.existsSync(fullPath)) {
      datasetLoadError = `Dataset file not found at ${DATASET_RELATIVE_PATH}`;
      cachedDataset = [];
      return { entries: cachedDataset, error: datasetLoadError, filePath: fullPath };
    }

    const raw = fs.readFileSync(fullPath, "utf8");
    const lines = raw.split(/\r?\n/);
    const entries: DatasetEntry[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const tabIdx = trimmed.indexOf("\t");
      if (tabIdx === -1) continue;
      const id = trimmed.slice(0, tabIdx).trim();
      const kn = trimmed.slice(tabIdx + 1).trim();
      if (!id || !kn) continue;
      entries.push({ id, kn });
    }

    cachedDataset = entries;
    datasetLoadError = null;
  } catch (err) {
    datasetLoadError =
      err instanceof Error ? err.message : "Failed to read dataset TSV file.";
    cachedDataset = [];
  }

  return { entries: cachedDataset, error: datasetLoadError, filePath: fullPath };
}

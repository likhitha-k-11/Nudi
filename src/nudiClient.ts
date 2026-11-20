export interface SyllableItem {
  kn: string;
  ph: string;
  tip: string;
}

export interface WordItem {
  id: string | number;
  datasetId?: string;
  cat: string;
  kn: string;
  tr: string;
  en: string;
  syl: SyllableItem[];
  isDataset?: boolean;
}

export interface AnalyzedResult {
  score: number;
  wordSimilarity?: number;
  charSimilarity?: number;
  expectedText?: string;
  recognizedText?: string;
  feedbackTier?: {
    level: "great" | "good" | "retry";
    message: string;
  };
  disclaimer?: string;
  syllables: Array<{ ok: boolean; note: string }>;
  mock: boolean;
}

interface ProgressLogEntry {
  id: string | number;
  kn?: string;
  score: number;
  t: number;
  mock?: boolean;
}

/* ============ CURATED WORD BANK (matches original NUDI W data) ============ */
const W: WordItem[] = (
  [
    ["g", "ನಮಸ್ಕಾರ", "Namaskara", "Hello / Greetings", [["ನ", "na", "Soft dental ‘n’, tongue on teeth."], ["ಮ", "ma", "Short ‘a’ like ‘u’ in ‘cup’."], ["ಸ್ಕಾ", "skaa", "Cluster: ‘s’ flows straight into ‘k’, long ‘aa’."], ["ರ", "ra", "Light tap of the tongue, not the English ‘r’."]]],
    ["g", "ಧನ್ಯವಾದಗಳು", "Dhanyavaadagalu", "Thank you", [["ಧ", "dha", "Aspirated dental ‘d’ — a puff of breath."], ["ನ್ಯ", "nya", "Nasal ‘ny’, like Spanish ‘ñ’."], ["ವಾ", "vaa", "Long ‘aa’, soft ‘v’."], ["ದ", "da", "Dental ‘d’."], ["ಗ", "ga", "Plain ‘g’."], ["ಳು", "lu", "Retroflex ‘ḷ’ — curl the tongue back — then ‘u’."]]],
    ["g", "ಹೇಗಿದ್ದೀರಾ", "Hegiddira", "How are you?", [["ಹೇ", "hee", "Long ‘e’ as in ‘hay’, without the glide."], ["ಗಿ", "gi", "Short ‘i’."], ["ದ್ದೀ", "ddee", "Doubled ‘d’: hold it, then long ‘ee’."], ["ರಾ", "raa", "Tapped ‘r’, long ‘aa’."]]],
    ["g", "ದಯವಿಟ್ಟು", "Dayavittu", "Please", [["ದ", "da", "Dental ‘d’."], ["ಯ", "ya", "Clear ‘y’."], ["ವಿ", "vi", "Soft ‘v’, short ‘i’."], ["ಟ್ಟು", "ttu", "Retroflex ‘ṭ’, held long."]]],
    ["f", "ನೀರು", "Neeru", "Water", [["ನೀ", "nee", "Long ‘ee’."], ["ರು", "ru", "Tapped ‘r’ + short ‘u’."]]],
    ["f", "ಊಟ", "Oota", "Food / Meal", [["ಊ", "oo", "Long ‘oo’ as in ‘pool’."], ["ಟ", "ṭa", "Retroflex ‘ṭ’ — tongue tip curls back."]]],
    ["f", "ಅನ್ನ", "Anna", "Cooked rice", [["ಅ", "a", "Short ‘a’."], ["ನ್ನ", "nna", "Held, doubled ‘n’."]]],
    ["f", "ಕಾಫಿ", "Kaaphi", "Coffee", [["ಕಾ", "kaa", "Long ‘aa’."], ["ಫಿ", "phi", "‘f’-like ‘ph’, short ‘i’."]]],
    ["h", "ಮನೆ", "Mane", "House", [["ಮ", "ma", "Short ‘a’."], ["ನೆ", "ne", "Short ‘e’ as in ‘net’."]]],
    ["h", "ಅಮ್ಮ", "Amma", "Mother", [["ಅ", "a", "Short ‘a’."], ["ಮ್ಮ", "mma", "Held, doubled ‘m’."]]],
    ["h", "ಅಪ್ಪ", "Appa", "Father", [["ಅ", "a", "Short ‘a’."], ["ಪ್ಪ", "ppa", "Held, doubled ‘p’ without a puff."]]],
    ["n", "ಒಂದು", "Ondu", "One", [["ಒಂ", "om", "Short ‘o’ then nasal ‘m/n’."], ["ದು", "du", "Dental ‘d’ + short ‘u’."]]],
    ["n", "ಎರಡು", "Eradu", "Two", [["ಎ", "e", "Short ‘e’."], ["ರ", "ra", "Tapped ‘r’."], ["ಡು", "ḍu", "Retroflex ‘ḍ’ + short ‘u’."]]],
    ["t", "ಎಲ್ಲಿ", "Elli", "Where?", [["ಎ", "e", "Short ‘e’."], ["ಲ್ಲಿ", "lli", "Held, doubled ‘l’, short ‘i’."]]],
    ["s", "ಬೆಲೆ ಎಷ್ಟು", "Bele eshtu", "How much?", [["ಬೆ", "be", "Short ‘e’."], ["ಲೆ", "le", "Short ‘e’."], ["ಎ", "e", "Short ‘e’."], ["ಷ್ಟು", "shtu", "Retroflex ‘sh’ into ‘ṭ’."]]],
  ] as Array<[string, string, string, string, Array<[string, string, string]>]>
).map((w, i) => ({
  id: i,
  cat: w[0],
  kn: w[1],
  tr: w[2],
  en: w[3],
  syl: w[4].map((s) => ({ kn: s[0], ph: s[1], tip: s[2] })),
}));

const CATS: Record<string, string> = {
  g: "Greetings",
  f: "Food",
  h: "Family",
  n: "Numbers",
  t: "Travel",
  s: "Shopping",
};

/* ============ SERVICE LAYER — wired to Express backend ============ */
const Service = {
  API_BASE: "/api",
  get isMock() {
    return !this.API_BASE;
  },
  async getWordDetails(id: string | number): Promise<WordItem> {
    const r = await fetch(`${this.API_BASE}/words/${encodeURIComponent(String(id))}`);
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      throw new Error(errBody.error || `Could not load word (${r.status})`);
    }
    return r.json();
  },
  async getDatasetSentences(
    q = "",
    offset = 0,
    limit = 20
  ): Promise<{ total: number; offset: number; limit: number; items: WordItem[] }> {
    const params = new URLSearchParams({
      q,
      offset: String(offset),
      limit: String(limit),
    });
    const r = await fetch(`${this.API_BASE}/dataset/sentences?${params.toString()}`);
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      throw new Error(errBody.error || `Dataset error (${r.status})`);
    }
    return r.json();
  },
  async getRandomDatasetSentence(): Promise<WordItem> {
    const r = await fetch(`${this.API_BASE}/dataset/random?maxLen=75`);
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      throw new Error(errBody.error || `Dataset error (${r.status})`);
    }
    return r.json();
  },
  async getReferenceAudio(w: WordItem): Promise<{ kind: "url"; url: string; revoke: boolean }> {
    const params = new URLSearchParams({
      word: w.kn,
      id: String(w.datasetId ?? w.id),
    });
    const r = await fetch(`${this.API_BASE}/audio?${params.toString()}`);
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      throw new Error(errBody.error || `Audio request failed (${r.status})`);
    }
    const audioBlob = await r.blob();
    return {
      kind: "url",
      url: URL.createObjectURL(audioBlob),
      revoke: true,
    };
  },
  async analyzePronunciation(w: WordItem, blob: Blob): Promise<AnalyzedResult> {
    const f = new FormData();
    f.append("word", w.kn);
    f.append("id", String(w.datasetId ?? w.id));
    f.append("syllables", JSON.stringify(w.syl));
    const ext = blob.type.includes("mp4") ? "rec.m4a" : blob.type.includes("ogg") ? "rec.ogg" : "rec.webm";
    f.append("audio", blob, ext);
    const r = await fetch(`${this.API_BASE}/analyze`, { method: "POST", body: f });
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      throw new Error(errBody.error || `Model returned ${r.status}`);
    }
    return this.normalizeResult(await r.json());
  },
  normalizeResult(raw: Record<string, unknown>): AnalyzedResult {
    return {
      score: Number(raw.score ?? 0),
      wordSimilarity: typeof raw.wordSimilarity === "number" ? raw.wordSimilarity : undefined,
      charSimilarity: typeof raw.charSimilarity === "number" ? raw.charSimilarity : undefined,
      expectedText: typeof raw.expectedText === "string" ? raw.expectedText : undefined,
      recognizedText: typeof raw.recognizedText === "string" ? raw.recognizedText : undefined,
      feedbackTier: raw.feedbackTier as AnalyzedResult["feedbackTier"],
      disclaimer: typeof raw.disclaimer === "string" ? raw.disclaimer : undefined,
      syllables: Array.isArray(raw.syllables)
        ? (raw.syllables as Array<{ ok: boolean; note: string }>)
        : [],
      mock: false,
    };
  },
  getPronunciationFeedback(res: AnalyzedResult, w: WordItem) {
    const good: Array<{ syl: SyllableItem; note: string }> = [];
    const bad: Array<{ syl: SyllableItem; note: string }> = [];
    res.syllables.forEach((s, i) => {
      const syl = w.syl[i];
      if (!syl) return;
      (s.ok ? good : bad).push({ syl, note: s.note });
    });
    return { good, bad, tips: bad.map((b) => `${b.syl.ph}: ${b.syl.tip}`) };
  },
};

/* ============ STORE ============ */
const KEY = "nudi.progress.v1";
const Store = {
  load(): { log: ProgressLogEntry[] } {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "") || { log: [] };
    } catch {
      return { log: [] };
    }
  },
  add(e: ProgressLogEntry) {
    const d = this.load();
    d.log.push(e);
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* ignore quota errors */
    }
  },
  reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

/* ============ HELPERS ============ */
const $ = <T extends Element = HTMLElement>(s: string, r: Document | Element = document) =>
  r.querySelector<T>(s);
const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
const bars = (n = 28) =>
  `<div class="bars" aria-hidden="true">${Array.from(
    { length: n },
    (_, i) => `<i style="animation-delay:${(i * 70) % 600}ms;height:${6 + Math.abs(Math.sin(i)) * 16}px"></i>`
  ).join("")}</div>`;

function toast(m: string) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

let activeAudio: HTMLAudioElement | null = null;
let audioRequestSeq = 0;
async function play(w: WordItem, wave: Element | null, btn?: HTMLButtonElement | null) {
  const seq = ++audioRequestSeq;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (btn) btn.disabled = true;
  wave && wave.classList.add("on");
  const done = () => {
    wave && wave.classList.remove("on");
    if (btn) btn.disabled = false;
  };
  try {
    const a = await Service.getReferenceAudio(w);
    if (seq !== audioRequestSeq) {
      if (a.revoke) URL.revokeObjectURL(a.url);
      done();
      return;
    }
    const au = new Audio(a.url);
    activeAudio = au;
    au.onended = () => {
      if (a.revoke) URL.revokeObjectURL(a.url);
      done();
    };
    au.onerror = () => {
      if (a.revoke) URL.revokeObjectURL(a.url);
      done();
      toast("Couldn’t play reference audio.");
    };
    au.onplay = () => wave && wave.classList.add("on");
    await au.play();
  } catch (err) {
    done();
    if (seq === audioRequestSeq) {
      toast(err instanceof Error ? err.message : "Couldn’t load reference audio.");
    }
  }
}

const wordRow = (w: WordItem) => {
  const isSentence = Boolean(w.isDataset || w.kn.length > 18);
  const href = `#studio/${encodeURIComponent(String(w.id))}`;
  return `<div class="wi ${isSentence ? "sentence" : ""}"><div class="k">${esc(w.kn)}</div><div class="t">${esc(w.tr)}</div><div class="m">${esc(w.en)}</div>
<div class="row acts"><button class="play" data-play="${esc(String(w.id))}" aria-label="Play ${esc(w.tr)}">▶</button><a class="btn ghost" style="padding:10px 16px;text-decoration:none" href="${href}">Practice</a></div></div>`;
};

function bindPlay(root: Element, itemLookup: Map<string, WordItem>) {
  root.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.play || "";
      const item = itemLookup.get(id) ?? W[Number(id)];
      if (item) void play(item, null, b);
    };
  });
}

/* ============ PAGES ============ */
const Pages: Record<string, (el: HTMLElement, arg?: string) => void | (() => void) | Promise<void | (() => void)>> = {
  home(el) {
    const lookup = new Map<string, WordItem>(W.map((w) => [String(w.id), w]));
    el.innerHTML = `
<section class="hero"><div><h1>Kannada is closer than you think.</h1>
<p class="lead">Learn to speak Kannada with confidence. Hear it, say it, and perfect every sound.</p>
<div class="row"><a class="btn" href="#studio" style="text-decoration:none">Start Speaking</a><a class="btn ghost" href="#explore" style="text-decoration:none">Explore Kannada</a></div></div>
<div class="stage"><div class="big kn" id="hk">ನಮಸ್ಕಾರ</div><div style="font-weight:800;font-size:22px">Namaskara</div><div style="color:var(--mute);margin-bottom:12px">Hello / Greetings</div>
<div class="row"><button class="play" id="hp" aria-label="Play Namaskara">▶</button><div id="hw">${bars()}</div></div><p class="cap">Kannada’s round letters grew up on palm leaf, where sharp straight strokes split the grain.</p></div></section>
<div class="steps"><div><h3>Hear</h3><div class="kn">ಕೇಳಿ</div><p>Listen to the word, then tap any syllable to see how it’s made.</p></div>
<div><h3>Speak</h3><div class="kn">ಹೇಳಿ</div><p>Record yourself with your microphone for real Kannada speech pronunciation feedback.</p></div>
<div><h3>Improve</h3><div class="kn">ಕಲಿಯಿರಿ</div><p>See which sounds landed and which need work, then try again.</p></div></div>
<h2 class="sec">Try a word</h2><div class="wl">${W.slice(0, 5).map(wordRow).join("")}</div>
<div class="cta"><h2>Your first word takes thirty seconds.</h2><a class="btn" href="#studio" style="text-decoration:none">Open the studio</a></div>`;
    const hp = $("#hp", el) as HTMLButtonElement | null;
    if (hp) hp.onclick = () => void play(W[0], $("#hw .bars", el), hp);
    bindPlay(el, lookup);
  },

  explore(el) {
    let cat = "all";
    let q = "";
    let dsOffset = 0;
    const dsLimit = 20;
    let dsTimer: number | null = null;

    el.innerHTML = `<h2 class="sec">Explore Kannada</h2><input type="search" id="q" placeholder="Search in English, Kannada, transliteration, or OpenSLR-79 ID" aria-label="Search words"><div class="chips" id="ch"></div><div class="wl" id="wl"></div>`;

    const renderChips = () => {
      const ch = $("#ch", el);
      if (!ch) return;
      ch.innerHTML = [
        ["all", "All"],
        ...Object.entries(CATS),
        ["dataset", "OpenSLR-79 Sentences"],
      ]
        .map(([k, v]) => `<button class="chip ${k === cat ? "on" : ""}" data-c="${k}">${v}</button>`)
        .join("");
      el.querySelectorAll<HTMLButtonElement>("[data-c]").forEach((b) => {
        b.onclick = () => {
          cat = b.dataset.c || "all";
          dsOffset = 0;
          void draw();
        };
      });
    };

    const draw = async () => {
      renderChips();
      const wl = $("#wl", el);
      if (!wl) return;

      if (cat === "dataset") {
        wl.innerHTML = `<div class="skel"></div><div class="skel" style="width:75%"></div><div class="skel" style="width:88%"></div>`;
        try {
          const data = await Service.getDatasetSentences(q, dsOffset, dsLimit);
          if (cat !== "dataset") return;
          const lookup = new Map<string, WordItem>(data.items.map((w) => [String(w.id), w]));
          const meta = `<p style="color:var(--mute);margin-bottom:14px">Showing ${data.total ? dsOffset + 1 : 0}–${Math.min(dsOffset + data.items.length, data.total)} of ${data.total.toLocaleString()} OpenSLR-79 Kannada sentences.</p>`;
          const rows = data.items.length
            ? data.items.map(wordRow).join("")
            : `<p style="padding:24px 0;color:var(--mute)">No dataset sentences match “${esc(q)}”.</p>`;
          const nav =
            data.total > dsLimit
              ? `<div class="row" style="margin-top:18px;justify-content:space-between">
                  <button class="btn ghost" id="dsPrev" ${dsOffset === 0 ? "disabled" : ""}>Previous</button>
                  <button class="btn ghost" id="dsNext" ${dsOffset + dsLimit >= data.total ? "disabled" : ""}>Next</button>
                 </div>`
              : "";
          wl.innerHTML = meta + rows + nav;
          bindPlay(wl, lookup);
          const prev = $("#dsPrev", wl) as HTMLButtonElement | null;
          const next = $("#dsNext", wl) as HTMLButtonElement | null;
          if (prev) prev.onclick = () => { dsOffset = Math.max(0, dsOffset - dsLimit); void draw(); };
          if (next) next.onclick = () => { dsOffset += dsLimit; void draw(); };
        } catch (err) {
          wl.innerHTML = `<div class="err" role="alert">${esc(err instanceof Error ? err.message : "Failed to load dataset.")}</div>`;
        }
        return;
      }

      const r = W.filter(
        (w) => (cat === "all" || w.cat === cat) && (w.kn + w.tr + w.en).toLowerCase().includes(q)
      );
      const lookup = new Map<string, WordItem>(r.map((w) => [String(w.id), w]));
      wl.innerHTML = r.length
        ? r.map(wordRow).join("")
        : `<p style="padding:24px 0;color:var(--mute)">No words match “${esc(q)}”. Try a shorter search or switch to OpenSLR-79 Sentences.</p>`;
      bindPlay(wl, lookup);
    };

    const qInput = $("#q", el) as HTMLInputElement | null;
    if (qInput) {
      qInput.oninput = (e) => {
        q = (e.target as HTMLInputElement).value.trim().toLowerCase();
        dsOffset = 0;
        if (cat === "dataset") {
          if (dsTimer) window.clearTimeout(dsTimer);
          dsTimer = window.setTimeout(() => void draw(), 200);
        } else {
          void draw();
        }
      };
    }
    void draw();
  },

  progress(el) {
    const log = Store.load().log;
    const by: Record<string, ProgressLogEntry[]> = {};
    log.forEach((e) => {
      const k = String(e.id);
      (by[k] = by[k] || []).push(e);
    });
    const best = (id: string) => Math.max(...by[id].map((e) => e.score));
    const practiced = Object.keys(by).length;
    const mastered = Object.keys(by).filter((i) => best(i) >= 85).length;
    const need = Object.keys(by).filter((i) => best(i) < 70);
    const avg = log.length ? Math.round(log.reduce((a, e) => a + e.score, 0) / log.length) : 0;
    const days = [...new Set(log.map((e) => new Date(e.t).toDateString()))].map((d) =>
      new Date(d).getTime()
    );
    let streak = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (!days.includes(d.getTime())) d.setDate(d.getDate() - 1);
    while (days.includes(d.getTime())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    const resolveWordItem = (idKey: string): WordItem | null => {
      const num = Number(idKey);
      if (Number.isInteger(num) && W[num]) return W[num];
      const latest = by[idKey]?.[by[idKey].length - 1];
      if (!latest) return null;
      return {
        id: idKey,
        cat: "dataset",
        kn: latest.kn || idKey,
        tr: idKey.replace(/^ds:/, ""),
        en: "OpenSLR-79 practice",
        syl: [],
        isDataset: true,
      };
    };

    const needItems = need.map(resolveWordItem).filter((x): x is WordItem => Boolean(x));
    const lookup = new Map<string, WordItem>(needItems.map((w) => [String(w.id), w]));
    const hasMockEntries = log.some((e) => e.mock);

    el.innerHTML = `<h2 class="sec">Your journey</h2>
 <div class="path">${W.map((w) => {
   const k = String(w.id);
   return `<a class="node ${by[k] ? (best(k) >= 85 ? "m" : "n") : "u"}" style="text-decoration:none;color:inherit" href="#studio/${w.id}" title="${esc(w.tr)}">${w.kn}</a>`;
 }).join("")}</div>
 <p style="color:var(--mute)">Green: mastered (best score 85+). Dashed: practiced. Faded: not tried yet.</p>
 <div class="stats"><div><b>${practiced}</b>words practiced</div><div><b>${streak}</b>day streak</div><div><b>${log.length ? avg : "–"}</b>average score</div><div><b>${mastered}</b>words mastered</div></div>
 ${hasMockEntries ? `<p style="margin-top:14px"><span class="badge">DEMO</span> Earlier demo scores were stored locally before live AI scoring was connected.</p>` : ""}
 <h2 class="sec" style="font-size:26px">Needs more practice</h2>
 ${needItems.length ? `<div class="wl" id="nwl">${needItems.map(wordRow).join("")}</div>` : `<p style="color:var(--mute)">${log.length ? "Nothing below 70. Nice." : "Record a word in the studio and it will show up here."}</p>`}
 <h2 class="sec" style="font-size:26px">Recent activity</h2>
 ${log.length ? log.slice(-6).reverse().map((e) => {
   const knLabel = (typeof e.id === "number" || /^\d+$/.test(String(e.id))) && W[Number(e.id)] ? W[Number(e.id)].kn : e.kn || String(e.id);
   return `<div class="wi ${knLabel.length > 18 ? "sentence" : ""}" style="grid-template-columns:1fr auto auto"><div class="k">${esc(knLabel)}</div><div class="t">${e.score}%</div><div class="m">${new Date(e.t).toLocaleString()}</div></div>`;
 }).join("") : `<p style="color:var(--mute)">No attempts yet. <a href="#studio" style="color:var(--red)">Practice your first word</a>.</p>`}
 ${log.length ? `<p style="margin-top:20px"><button class="btn ghost" id="rs">Reset progress</button></p>` : ""}`;

    const nwl = $("#nwl", el);
    if (nwl) bindPlay(nwl, lookup);
    const rs = $("#rs", el);
    if (rs) {
      rs.onclick = () => {
        Store.reset();
        toast("Progress reset.");
        void Pages.progress(el);
      };
    }
  },

  async studio(el, arg) {
    let cur: WordItem = W[0];
    let sideMode: "words" | "dataset" = arg && (arg.startsWith("ds:") || arg.startsWith("knm_")) ? "dataset" : "words";

    if (arg !== undefined && arg !== "") {
      if (arg.startsWith("ds:") || arg.startsWith("knm_")) {
        try {
          cur = await Service.getWordDetails(arg.startsWith("ds:") ? arg : `ds:${arg}`);
        } catch {
          cur = W[0];
          sideMode = "words";
        }
      } else if (/^\d+$/.test(arg) && W[Number(arg)]) {
        cur = W[Number(arg)];
      }
    }

    let sel = 0;
    let q = "";
    let st: "ready" | "recording" | "done" | "analyzing" | "results" | "error" = "ready";
    let blob: Blob | null = null;
    let url: string | null = null;
    let rec: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let t0 = 0;
    let tick: number | null = null;
    let res: AnalyzedResult | null = null;
    let err = "";
    let datasetItems: WordItem[] = [];
    let dsTimer: number | null = null;

    el.innerHTML = `<div class="studio"><aside class="side">
      <div class="chips" style="margin-bottom:12px">
        <button class="chip ${sideMode === "words" ? "on" : ""}" id="smW">Words</button>
        <button class="chip ${sideMode === "dataset" ? "on" : ""}" id="smD">OpenSLR-79</button>
      </div>
      <input type="search" id="q" placeholder="Search ${sideMode === "dataset" ? "sentences" : "words"}" aria-label="Search words">
      ${sideMode === "dataset" ? `<button class="btn ghost" id="rndS" style="width:100%;padding:9px 12px;margin-bottom:10px;font-size:13px">Try another sentence</button>` : ""}
      <div class="wl" id="sl"></div>
    </aside>
    <section class="focus" id="fc"></section><section id="fb"></section></div>`;

    const cleanup = () => {
      if (tick !== null) window.clearInterval(tick);
      if (dsTimer !== null) window.clearTimeout(dsTimer);
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      if (url) URL.revokeObjectURL(url);
      url = null;
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }
    };

    const resetAttempt = () => {
      if (tick !== null) window.clearInterval(tick);
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      if (url) URL.revokeObjectURL(url);
      url = null;
      blob = null;
      res = null;
      err = "";
      st = "ready";
    };

    const selectItem = (item: WordItem) => {
      resetAttempt();
      cur = item;
      sel = 0;
      history.replaceState(null, "", `#studio/${encodeURIComponent(String(cur.id))}`);
      void list();
      word();
      fb();
    };

    const list = async () => {
      const sl = $("#sl", el);
      if (!sl) return;

      const smW = $("#smW", el);
      const smD = $("#smD", el);
      if (smW) smW.classList.toggle("on", sideMode === "words");
      if (smD) smD.classList.toggle("on", sideMode === "dataset");

      if (sideMode === "words") {
        const r = W.filter((w) => (w.kn + w.tr + w.en + (CATS[w.cat] || "")).toLowerCase().includes(q));
        sl.innerHTML =
          r
            .map(
              (w) =>
                `<button class="${w.id === cur.id ? "on" : ""}" data-w="${w.id}"><span class="kn" style="font-size:18px">${esc(w.kn)}</span><span style="color:var(--mute);font-size:13px">${esc(w.tr)}</span></button>`
            )
            .join("") || `<p style="color:var(--mute)">No match.</p>`;
        sl.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => {
          b.onclick = () => {
            const target = W[Number(b.dataset.w)];
            if (target) selectItem(target);
          };
        });
      } else {
        sl.innerHTML = `<div class="skel"></div><div class="skel" style="width:70%"></div>`;
        try {
          const data = await Service.getDatasetSentences(q, 0, 25);
          datasetItems = cur.isDataset && !data.items.some((x) => x.id === cur.id) && !q
            ? [cur, ...data.items]
            : data.items;
          sl.innerHTML =
            datasetItems
              .map(
                (w) =>
                  `<button class="${w.id === cur.id ? "on" : ""}" data-ds="${esc(String(w.id))}"><span class="kn" style="font-size:15px;line-height:1.35">${esc(w.kn)}</span></button>`
              )
              .join("") || `<p style="color:var(--mute)">No match.</p>`;
          sl.querySelectorAll<HTMLButtonElement>("[data-ds]").forEach((b) => {
            b.onclick = () => {
              const target = datasetItems.find((x) => String(x.id) === b.dataset.ds);
              if (target) selectItem(target);
            };
          });
        } catch (e) {
          sl.innerHTML = `<div class="err">${esc(e instanceof Error ? e.message : "Failed to load sentences.")}</div>`;
        }
      }
    };

    const word = () => {
      const fc = $("#fc", el);
      if (!fc) return;
      const isSentence = Boolean(cur.isDataset || cur.kn.length > 18);
      const catLabel = cur.isDataset ? "OpenSLR-79 Dataset" : CATS[cur.cat] || "Kannada";
      const safeSel = cur.syl[sel] ? sel : 0;
      const currentSyl = cur.syl[safeSel];

      fc.innerHTML = `<div style="color:var(--mute);font-weight:600">${esc(catLabel)}</div><div class="kw ${isSentence ? "sentence" : ""}">${esc(cur.kn)}</div>
        <div style="font:800 22px var(--la)">${cur.syl.map((s) => esc(s.ph)).join("·")}</div>
        <div style="color:var(--mute);margin-bottom:12px">${esc(cur.tr)} — ${esc(cur.en)}</div>
        <div class="row"><button class="play" id="pl" aria-label="Play reference">▶</button><div id="wv">${bars(36)}</div></div>
        <div class="syl" id="sy">${cur.syl
          .map((s, i) => {
            const r = res && res.syllables[i];
            return `<button data-s="${i}" class="${i === safeSel ? "on" : ""} ${r ? (r.ok ? "ok" : "bad") : ""}"><span class="kn">${esc(s.kn)}</span> ${esc(s.ph)}</button>`;
          })
          .join("")}</div>
        ${currentSyl ? `<div class="tip" id="tp"><b class="kn">${esc(currentSyl.kn)}</b> — ${esc(currentSyl.tip)}</div>` : ""}
        <p style="color:var(--mute);font-size:13px;margin-top:10px">${
          cur.isDataset
            ? "Sentence sourced from OpenSLR-79 Kannada corpus (line_index_male.tsv)."
            : "Syllable guidance is draft content pending native-speaker review."
        }</p>`;

      const pl = $("#pl", el) as HTMLButtonElement | null;
      if (pl) pl.onclick = () => void play(cur, $("#wv .bars", el), pl);
      fc.querySelectorAll<HTMLButtonElement>("[data-s]").forEach((b) => {
        b.onclick = () => {
          sel = Number(b.dataset.s);
          word();
        };
      });
    };

    const fmt = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    };

    const start = async () => {
      err = "";
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        st = "error";
        err = "This browser doesn’t support microphone recording. Try current Chrome, Edge, Safari or Firefox over HTTPS.";
        return fb();
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        st = "error";
        const errObj = e as Error;
        err =
          errObj.name === "NotAllowedError"
            ? "Microphone access was blocked. Allow it in your browser’s site settings, then press Record again."
            : errObj.name === "NotFoundError"
            ? "No microphone found. Connect one and try again."
            : `Couldn’t start the microphone: ${errObj.message}`;
        return fb();
      }

      const ch: BlobPart[] = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size) ch.push(e.data);
      };
      rec.onstop = () => {
        if (tick !== null) window.clearInterval(tick);
        stream && stream.getTracks().forEach((t) => t.stop());
        blob = new Blob(ch, { type: rec?.mimeType || "audio/webm" });
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        st = "done";
        fb();
      };
      rec.start();
      t0 = Date.now();
      st = "recording";
      fb();
      tick = window.setInterval(() => {
        const t = $("#tm", el);
        if (t) t.textContent = fmt();
      }, 250);
    };

    const submit = async () => {
      if (!blob) return;
      st = "analyzing";
      fb();
      try {
        const r = await Service.analyzePronunciation(cur, blob);
        res = r;
        Store.add({ id: cur.id, kn: cur.kn, score: r.score, t: Date.now(), mock: r.mock });
        st = "results";
        word();
        fb();
        toast("Analysis ready.");
      } catch (e) {
        st = "error";
        err = `Analysis failed: ${e instanceof Error ? e.message : String(e)}. Your recording is kept — press Submit to retry.`;
        fb();
      }
    };

    const fb = () => {
      const o = $("#fb", el);
      if (!o) return;
      let h = `<h3 style="font:800 20px var(--la)">Your turn</h3>`;
      const labels: Record<typeof st, string> = {
        ready: "Ready to record",
        recording: "Recording…",
        done: "Recording complete",
        analyzing: "Analyzing…",
        results: "Results available",
        error: "Something went wrong",
      };
      h += `<button class="rec ${st === "recording" ? "live" : ""}" id="rb" aria-label="${st === "recording" ? "Stop recording" : "Start recording"}" ${st === "analyzing" ? "disabled" : ""}>${st === "recording" ? "■" : "●"}</button><div class="time" id="tm">${st === "recording" ? fmt() : "00:00"}</div><div class="state" role="status">${labels[st]}</div>`;
      if (st === "error") h += `<div class="err" role="alert">${esc(err)}</div>`;
      if (url && st !== "recording") {
        h += `<audio controls src="${url}" style="width:100%;margin-top:14px"></audio><div class="row" style="margin-top:10px"><button class="btn" id="sb" ${st === "analyzing" || st === "results" ? "disabled" : ""}>Submit recording</button><button class="btn ghost" id="rr">Record again</button></div>`;
      }
      if (st === "analyzing") {
        h += `<div class="skel"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:85%"></div>`;
      }
      if (st === "results" && res) {
        const f = Service.getPronunciationFeedback(res, cur);
        h += `<div style="margin-top:18px"><div class="score">${res.score}<span style="font-size:22px">%</span></div>
        ${res.feedbackTier ? `<p style="font-weight:700;margin-top:6px">${esc(res.feedbackTier.message)}</p>` : ""}
        ${typeof res.recognizedText === "string" ? `<div class="tip" style="margin-top:12px;min-height:0"><div style="font-size:13px;color:var(--mute)">What Nudi heard:</div><div class="kn" style="font-size:20px;margin-top:2px">${res.recognizedText ? esc(res.recognizedText) : "<i>(no speech recognized)</i>"}</div></div>` : ""}
        <p style="margin-top:12px"><b style="color:var(--leaf)">Landed:</b> ${f.good.map((g) => `<span class="kn">${esc(g.syl.kn)}</span>`).join(" ") || "–"}</p>
        <p><b style="color:var(--warn)">Work on:</b> ${f.bad.map((g) => `<span class="kn">${esc(g.syl.kn)}</span>`).join(" ") || "nothing — great run"}</p>
        ${f.tips.length ? `<ul style="padding-left:18px;color:var(--mute);margin-top:8px">${f.tips.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        ${res.disclaimer ? `<p style="font-size:12px;color:var(--mute);margin-top:12px">${esc(res.disclaimer)}</p>` : ""}</div>`;
      }
      o.innerHTML = h;

      const rb = $("#rb", el);
      if (rb) {
        rb.onclick = () => {
          if (st === "recording") rec?.stop();
          else if (st !== "analyzing") void start();
        };
      }
      const sb = $("#sb", el);
      if (sb) sb.onclick = () => void submit();
      const rr = $("#rr", el);
      if (rr) {
        rr.onclick = () => {
          resetAttempt();
          word();
          fb();
        };
      }
    };

    const bindSideControls = () => {
      const smW = $("#smW", el);
      const smD = $("#smD", el);
      const sideEl = $(".side", el);
      const qInput = $("#q", el) as HTMLInputElement | null;

      if (smW) {
        smW.onclick = () => {
          if (sideMode === "words") return;
          sideMode = "words";
          q = "";
          if (qInput) {
            qInput.value = "";
            qInput.placeholder = "Search words";
          }
          const existingRnd = $("#rndS", el);
          if (existingRnd) existingRnd.remove();
          void list();
        };
      }
      if (smD) {
        smD.onclick = () => {
          if (sideMode === "dataset") return;
          sideMode = "dataset";
          q = "";
          if (qInput) {
            qInput.value = "";
            qInput.placeholder = "Search sentences";
          }
          if (sideEl && !$("#rndS", el) && qInput) {
            const rndBtn = document.createElement("button");
            rndBtn.className = "btn ghost";
            rndBtn.id = "rndS";
            rndBtn.style.cssText = "width:100%;padding:9px 12px;margin-bottom:10px;font-size:13px";
            rndBtn.textContent = "Try another sentence";
            rndBtn.onclick = () => {
              void Service.getRandomDatasetSentence()
                .then(selectItem)
                .catch((e) => toast(e instanceof Error ? e.message : "Failed to load sentence."));
            };
            qInput.insertAdjacentElement("afterend", rndBtn);
          }
          void list();
        };
      }

      const rndBtn = $("#rndS", el);
      if (rndBtn) {
        rndBtn.onclick = () => {
          void Service.getRandomDatasetSentence()
            .then(selectItem)
            .catch((e) => toast(e instanceof Error ? e.message : "Failed to load sentence."));
        };
      }

      if (qInput) {
        qInput.oninput = (e) => {
          q = (e.target as HTMLInputElement).value.trim().toLowerCase();
          if (sideMode === "dataset") {
            if (dsTimer !== null) window.clearTimeout(dsTimer);
            dsTimer = window.setTimeout(() => void list(), 200);
          } else {
            void list();
          }
        };
      }
    };

    bindSideControls();
    await list();
    word();
    fb();
    return cleanup;
  },
};

export function initNudiRouter(): () => void {
  let cleanup: (() => void) | null = null;

  const route = () => {
    const rawHash = location.hash.slice(1) || "home";
    const slashIdx = rawHash.indexOf("/");
    const r = slashIdx === -1 ? rawHash : rawHash.slice(0, slashIdx);
    const arg = slashIdx === -1 ? undefined : decodeURIComponent(rawHash.slice(slashIdx + 1));
    const page = Pages[r] ? r : "home";

    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    document.querySelectorAll<HTMLAnchorElement>("nav a").forEach((a) => {
      a.classList.toggle("on", a.dataset.r === page);
    });
    const el = $("#app");
    if (!el) return;
    el.innerHTML = "";
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    window.scrollTo(0, 0);
    void Promise.resolve(Pages[page](el, arg)).then((c) => {
      if (typeof c === "function") cleanup = c;
    });
  };

  window.addEventListener("hashchange", route);
  route();

  return () => {
    window.removeEventListener("hashchange", route);
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  };
}

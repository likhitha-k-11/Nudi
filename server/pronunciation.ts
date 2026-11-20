import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { splitKannadaAksharas } from "./data.ts";

const execFileAsync = promisify(execFile);

const TTS_CACHE_MAX = 150;
const ttsCache = new Map<string, Buffer>();

export class ApiServiceError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== "MY_GEMINI_API_KEY");
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new ApiServiceError(
      "GEMINI_API_KEY is not configured. Please add your key in the Settings > Secrets panel.",
      503
    );
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function formatGeminiError(err: unknown): ApiServiceError {
  if (err instanceof ApiServiceError) return err;
  let msg = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(msg) as { error?: { message?: string } };
    if (parsed?.error?.message) msg = parsed.error.message;
  } catch {
    /* keep raw message if not JSON */
  }
  if (msg.includes("API_KEY_INVALID") || msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
    return new ApiServiceError(
      "Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.",
      403
    );
  }
  if (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("429") ||
    msg.toLowerCase().includes("exceeded your current quota")
  ) {
    return new ApiServiceError(
      "Gemini API quota or rate limit reached. Please wait or check your billing plan in AI Studio.",
      429
    );
  }
  if (msg.includes("UNAVAILABLE") || msg.includes("503") || msg.includes("high demand")) {
    return new ApiServiceError(
      "The Gemini speech model is temporarily experiencing high demand. Please retry in a moment.",
      503
    );
  }
  if (msg.includes("NOT_FOUND") || msg.includes("404")) {
    return new ApiServiceError(
      "Requested Gemini speech model is unavailable. Please try again later.",
      502
    );
  }
  return new ApiServiceError(msg || "Gemini service request failed.", 502);
}

async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [500, 1200];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isDailyQuota = msg.toLowerCase().includes("requests per day") || msg.toLowerCase().includes("exceeded your current quota");
      const isTransient =
        !isDailyQuota &&
        (msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand") ||
          msg.includes("429") ||
          msg.includes("ECONNRESET") ||
          msg.includes("ETIMEDOUT"));
      if (!isTransient || attempt === delays.length) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}

/**
 * Mirrors Python's difflib.SequenceMatcher(None, a, b).ratio() using
 * recursive longest-contiguous-matching-block (Ratcliff/Obershelp) calculation.
 */
function sequenceMatcherRatio<T>(a: readonly T[], b: readonly T[]): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  if (lenA === 0 || lenB === 0) return 0;

  let matches = 0;
  const queue: Array<[number, number, number, number]> = [[0, lenA, 0, lenB]];

  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    let bestI = alo;
    let bestJ = blo;
    let bestSize = 0;

    let prev = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const next = new Map<number, number>();
      for (let j = blo; j < bhi; j++) {
        if (a[i] === b[j]) {
          const k = (prev.get(j - 1) ?? 0) + 1;
          next.set(j, k);
          if (k > bestSize) {
            bestSize = k;
            bestI = i - k + 1;
            bestJ = j - k + 1;
          }
        }
      }
      prev = next;
    }

    if (bestSize > 0) {
      matches += bestSize;
      if (alo < bestI && blo < bestJ) {
        queue.push([alo, bestI, blo, bestJ]);
      }
      if (bestI + bestSize < ahi && bestJ + bestSize < bhi) {
        queue.push([bestI + bestSize, ahi, bestJ + bestSize, bhi]);
      }
    }
  }

  return (2 * matches) / (lenA + lenB);
}

/**
 * Equivalent to Python's `re.findall(r'\w+', text.lower())`, using Unicode letters,
 * combining marks (essential for Kannada matras/virama), and numbers.
 */
function tokenizeWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{M}\p{N}_]+/gu);
  return matches ?? [];
}

function normalizeKannadaChars(text: string): string[] {
  return Array.from(text.replace(/[\s.,!?'"“”‘’()[\]{};:\-–—]/g, "").toLowerCase());
}

export async function convertAudioBufferToWav(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const id = crypto.randomUUID();
  const ext =
    mimeType.includes("wav")
      ? "wav"
      : mimeType.includes("mp3") || mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : "webm";

  const inPath = path.join(os.tmpdir(), `nudi-in-${id}.${ext}`);
  const outPath = path.join(os.tmpdir(), `nudi-out-${id}.wav`);

  try {
    fs.writeFileSync(inPath, audioBuffer);
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", inPath, "-ac", "1", "-ar", "16000", "-f", "wav", outPath],
      { timeout: 15000 }
    );
    const wav = fs.readFileSync(outPath);
    return { buffer: wav, mimeType: "audio/wav" };
  } catch (err) {
    // If input is already WAV and ffmpeg isn't happy or failed, return original if WAV
    if (ext === "wav" && audioBuffer.length > 44) {
      return { buffer: audioBuffer, mimeType: "audio/wav" };
    }
    throw new ApiServiceError(
      `Could not decode recorded audio (${mimeType || "unknown"}): ${
        err instanceof Error ? err.message : String(err)
      }`,
      400
    );
  } finally {
    try {
      if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch {
      /* ignore */
    }
  }
}

function hasAudibleSpeech(wavBuffer: Buffer): boolean {
  const dataMarker = wavBuffer.indexOf(Buffer.from("data"));
  if (dataMarker === -1 || dataMarker + 8 >= wavBuffer.length) return false;
  const dataOffset = dataMarker + 8;
  const dataSize = wavBuffer.readUInt32LE(dataMarker + 4);
  const dataEnd = Math.min(wavBuffer.length, dataOffset + dataSize);
  let peak = 0;
  let sumSq = 0;
  let sampleCount = 0;
  for (let i = dataOffset; i + 1 < dataEnd; i += 2) {
    const sample = wavBuffer.readInt16LE(i);
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    sumSq += sample * sample;
    sampleCount++;
  }
  if (sampleCount === 0) return false;
  const rms = Math.sqrt(sumSq / sampleCount);
  // Reject completely silent or ultra-low digital noise recordings
  return peak >= 250 && rms >= 25;
}

export async function transcribeKannadaSpeech(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "audio/wav" && !hasAudibleSpeech(audioBuffer)) {
    return "";
  }

  const ai = getGeminiClient();

  try {
    const response = await withTransientRetry(() =>
      ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBuffer.toString("base64"),
              },
            },
            {
              text: "Transcribe only the exact spoken words from this audio using Kannada script (kn). Do not use Devanagari, Gurmukhi, or Latin script.",
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            "You are a literal acoustic speech-to-text transcriber for Kannada (kn-IN). Output ONLY the words actually spoken in the audio in Kannada Unicode script (U+0C80–U+0CFF). Never output Devanagari, Gurmukhi, English commentary, or punctuation labels. Preserve actual mispronunciations literally as heard. If the audio is silent or unintelligible, return an empty string.",
        },
      })
    );

    return (response.text ?? "").trim();
  } catch (err) {
    throw formatGeminiError(err);
  }
}

export async function synthesizeKannadaReference(text: string): Promise<Buffer> {
  const key = text.trim();
  if (!key) {
    throw new ApiServiceError("Missing Kannada text for reference audio.", 400);
  }

  const cached = ttsCache.get(key);
  if (cached) {
    return cached;
  }

  const cacheDir = path.join(os.tmpdir(), "nudi-tts-cache");
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const cacheFile = path.join(cacheDir, `${hash}.wav`);
  try {
    if (fs.existsSync(cacheFile)) {
      const diskWav = fs.readFileSync(cacheFile);
      if (diskWav.length > 44) {
        ttsCache.set(key, diskWav);
        return diskWav;
      }
    }
  } catch {
    /* ignore cache read failure */
  }

  const ai = getGeminiClient();

  try {
    const response = await withTransientRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: key,
                speechMetadata: {
                  style: "Clear, measured native Kannada speaker pronouncing carefully for a language learner.",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      })
    );

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new ApiServiceError(
        "Gemini TTS did not return reference audio data.",
        502
      );
    }

    const wavBuffer = Buffer.from(base64Audio, "base64");
    if (ttsCache.size >= TTS_CACHE_MAX) {
      const oldest = ttsCache.keys().next().value;
      if (oldest) ttsCache.delete(oldest);
    }
    ttsCache.set(key, wavBuffer);
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, wavBuffer);
    } catch {
      /* ignore cache write failure */
    }
    return wavBuffer;
  } catch (err) {
    throw formatGeminiError(err);
  }
}

export interface AnalyzedSyllable {
  ok: boolean;
  note: string;
}

export interface PronunciationAnalysisResult {
  score: number;
  wordSimilarity: number;
  charSimilarity: number;
  expectedText: string;
  recognizedText: string;
  feedbackTier: {
    level: "great" | "good" | "retry";
    message: string;
  };
  disclaimer: string;
  syllables: AnalyzedSyllable[];
  mock: false;
}

export function evaluatePronunciation(
  expectedText: string,
  recognizedText: string,
  syllablesInput: Array<{ kn: string }>
): PronunciationAnalysisResult {
  const targetWords = tokenizeWords(expectedText);
  const spokenWords = tokenizeWords(recognizedText);

  // Faithful app.py word-level SequenceMatcher similarity
  const wordSimRaw = sequenceMatcherRatio(targetWords, spokenWords) * 100;
  const wordSimilarity = Math.round(wordSimRaw);

  // Fine-grained Kannada character/akshara similarity for single words and partial matches
  const targetChars = normalizeKannadaChars(expectedText);
  const spokenChars = normalizeKannadaChars(recognizedText);
  const charSimRaw = sequenceMatcherRatio(targetChars, spokenChars) * 100;
  const charSimilarity = Math.round(charSimRaw);

  const score =
    targetWords.length <= 1
      ? charSimilarity
      : Math.round(0.6 * wordSimRaw + 0.4 * charSimRaw);

  // Align each expected syllable / unit against what was heard
  const targetUnits =
    syllablesInput.length > 0
      ? syllablesInput.map((s) => s.kn)
      : splitKannadaAksharas(expectedText);

  const spokenAksharas = splitKannadaAksharas(recognizedText);
  const spokenSet = new Set(spokenWords);

  let searchCursor = 0;
  const syllables: AnalyzedSyllable[] = targetUnits.map((unit) => {
    if (!recognizedText.trim()) {
      return {
        ok: false,
        note: "No clear Kannada speech was detected for this sound.",
      };
    }

    const cleanUnit = unit.replace(/[.,!?'"“”‘’()[\]{};:\-–—]/g, "");
    // Word-level unit check (used for long dataset sentences)
    if (cleanUnit.includes(" ") || (targetWords.length > 4 && spokenSet.has(cleanUnit.toLowerCase()))) {
      const matched = spokenSet.has(cleanUnit.toLowerCase());
      return {
        ok: matched,
        note: matched
          ? "Heard clearly in your spoken sentence."
          : "This word differed or was missed in transcription.",
      };
    }

    // Akshara-level check in order inside spokenAksharas
    const unitAksharas = splitKannadaAksharas(cleanUnit);
    const primary = unitAksharas[0] ?? cleanUnit;

    let foundIdx = -1;
    for (let idx = searchCursor; idx < spokenAksharas.length; idx++) {
      if (
        spokenAksharas[idx] === cleanUnit ||
        spokenAksharas[idx] === primary
      ) {
        foundIdx = idx;
        break;
      }
    }

    if (foundIdx !== -1) {
      searchCursor = foundIdx + 1;
      return {
        ok: true,
        note: "Matched clearly in the recognized Kannada speech.",
      };
    }

    // Check consonant base / partial character similarity if exact akshara had slight vowel shift
    const unitChars = normalizeKannadaChars(cleanUnit);
    const spokenWindow = spokenAksharas.slice(
      Math.max(0, searchCursor - 1),
      Math.min(spokenAksharas.length, searchCursor + 3)
    );
    const closeMatch = spokenWindow.some((sa) => {
      const saChars = normalizeKannadaChars(sa);
      return (
        unitChars.length > 0 &&
        saChars.length > 0 &&
        unitChars[0] === saChars[0] &&
        sequenceMatcherRatio(unitChars, saChars) >= 0.75
      );
    });

    if (closeMatch) {
      return {
        ok: true,
        note: "Close match detected with slight vowel variation.",
      };
    }

    return {
      ok: false,
      note: "Sounded different from the reference pronunciation.",
    };
  });

  // Match app.py 3-tier threshold messages
  const feedbackTier =
    score >= 80
      ? { level: "great" as const, message: "Great job! Very close to the target." }
      : score >= 50
      ? { level: "good" as const, message: "Good effort! Try matching a few more sounds." }
      : {
          level: "retry" as const,
          message: "Keep trying! Listen to the reference and record again.",
        };

  return {
    score,
    wordSimilarity,
    charSimilarity,
    expectedText,
    recognizedText,
    feedbackTier,
    disclaimer:
      "Note: Similarity is estimated from recognized Kannada speech text, not raw acoustic phonemes.",
    syllables,
    mock: false,
  };
}

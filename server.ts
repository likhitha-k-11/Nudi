import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import {
  CATEGORIES,
  WORDS,
  buildDatasetPracticeItem,
  loadOpenSlrDataset,
} from "./server/data.ts";
import {
  ApiServiceError,
  convertAudioBufferToWav,
  evaluatePronunciation,
  isGeminiConfigured,
  synthesizeKannadaReference,
  transcribeKannadaSpeech,
} from "./server/pronunciation.ts";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  // Load OpenSLR-79 dataset safely on startup without modifying source file
  const dataset = loadOpenSlrDataset();

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      datasetLoaded: dataset.entries.length > 0,
      datasetError: dataset.error,
      sentenceCount: dataset.entries.length,
      wordCount: WORDS.length,
      geminiConfigured: isGeminiConfigured(),
    });
  });

  app.get("/api/words", (_req, res) => {
    res.json({
      categories: CATEGORIES,
      words: WORDS,
    });
  });

  app.get("/api/words/:id", (req, res) => {
    const rawId = req.params.id;
    const dsId = rawId.startsWith("ds:") ? rawId.slice(3) : rawId;

    if (rawId.startsWith("ds:") || dsId.startsWith("knm_")) {
      const entry = dataset.entries.find((e) => e.id === dsId);
      if (!entry) {
        return res.status(404).json({ error: `Dataset sentence "${dsId}" not found.` });
      }
      return res.json(buildDatasetPracticeItem(entry));
    }

    const numId = Number(rawId);
    const word = Number.isInteger(numId)
      ? WORDS.find((w) => w.id === numId)
      : undefined;
    if (!word) {
      return res.status(404).json({ error: `Word "${rawId}" not found.` });
    }
    return res.json(word);
  });

  app.get("/api/dataset/stats", (_req, res) => {
    if (dataset.error) {
      return res.status(500).json({ error: dataset.error, sentenceCount: 0 });
    }
    return res.json({
      source: "OpenSLR SLR79 (line_index_male.tsv)",
      sentenceCount: dataset.entries.length,
    });
  });

  app.get("/api/dataset/sentences", (req, res) => {
    if (dataset.error) {
      return res.status(500).json({ error: dataset.error });
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const filtered = q
      ? dataset.entries.filter(
          (e) =>
            e.kn.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
        )
      : dataset.entries;

    const slice = filtered.slice(offset, offset + limit).map(buildDatasetPracticeItem);

    return res.json({
      total: filtered.length,
      offset,
      limit,
      items: slice,
    });
  });

  app.get("/api/dataset/random", (req, res) => {
    if (dataset.error) {
      return res.status(500).json({ error: dataset.error });
    }
    if (dataset.entries.length === 0) {
      return res.status(404).json({ error: "No dataset sentences loaded." });
    }

    const maxLen = Number(req.query.maxLen) || 0;
    const pool =
      maxLen > 0
        ? dataset.entries.filter((e) => e.kn.length <= maxLen)
        : dataset.entries;
    const chosenPool = pool.length > 0 ? pool : dataset.entries;
    const entry = chosenPool[Math.floor(Math.random() * chosenPool.length)];
    return res.json(buildDatasetPracticeItem(entry));
  });

  app.get("/api/audio", async (req, res) => {
    try {
      const word = typeof req.query.word === "string" ? req.query.word.trim() : "";
      const id = typeof req.query.id === "string" ? req.query.id.trim() : "";

      if (!word) {
        return res.status(400).json({ error: "Query parameter 'word' is required." });
      }

      // Check optional local OpenSLR-79 WAV directory if configured
      const wavDir = process.env.OPENSLR79_WAV_DIR?.trim();
      if (wavDir && id) {
        const safeId = id.replace(/^ds:/, "").replace(/[^a-zA-Z0-9_-]/g, "");
        const candidatePath = path.join(wavDir, `${safeId}.wav`);
        if (fs.existsSync(candidatePath)) {
          res.setHeader("Content-Type", "audio/wav");
          res.setHeader("Cache-Control", "public, max-age=3600");
          return fs.createReadStream(candidatePath).pipe(res);
        }
      }

      const wavBuffer = await synthesizeKannadaReference(word);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", String(wavBuffer.length));
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(wavBuffer);
    } catch (err) {
      const apiErr =
        err instanceof ApiServiceError
          ? err
          : new ApiServiceError(
              err instanceof Error ? err.message : "Failed to load reference audio.",
              500
            );
      return res.status(apiErr.status).json({ error: apiErr.message });
    }
  });

  app.post("/api/analyze", upload.single("audio"), async (req, res) => {
    try {
      const targetWord =
        typeof req.body?.word === "string" ? req.body.word.trim() : "";
      if (!targetWord) {
        return res.status(400).json({ error: "Target Kannada word or sentence is required." });
      }

      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({ error: "Recorded audio file is missing or empty." });
      }

      let syllablesInput: Array<{ kn: string }> = [];
      if (typeof req.body?.syllables === "string" && req.body.syllables.trim()) {
        try {
          const parsed = JSON.parse(req.body.syllables);
          if (Array.isArray(parsed)) {
            syllablesInput = parsed.filter(
              (s) => s && typeof s.kn === "string"
            );
          }
        } catch {
          syllablesInput = [];
        }
      } else {
        const matched = WORDS.find((w) => w.kn === targetWord);
        if (matched) {
          syllablesInput = matched.syl;
        }
      }

      // Normalize WebM/OGG/MP4 browser audio into standard 16kHz mono WAV via ffmpeg
      const wav = await convertAudioBufferToWav(
        req.file.buffer,
        req.file.mimetype || "audio/webm"
      );

      const recognizedText = await transcribeKannadaSpeech(
        wav.buffer,
        wav.mimeType
      );

      const result = evaluatePronunciation(
        targetWord,
        recognizedText,
        syllablesInput
      );

      return res.json(result);
    } catch (err) {
      const apiErr =
        err instanceof ApiServiceError
          ? err
          : new ApiServiceError(
              err instanceof Error ? err.message : "Pronunciation analysis failed.",
              500
            );
      return res.status(apiErr.status).json({ error: apiErr.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Nudi server listening on http://0.0.0.0:${PORT} (OpenSLR-79 sentences loaded: ${dataset.entries.length})`
    );
  });
}

startServer().catch((err) => {
  console.error("Failed to start Nudi server:", err);
  process.exit(1);
});

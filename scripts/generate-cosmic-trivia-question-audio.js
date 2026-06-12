import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareVoiceText } from "../server/voice-library/text.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const packPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "question-packs", "core.json");
const hostManifestPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "audio", "tts-manifest.json");

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = new Map();
  const flags = new Set();

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith("--")) continue;

    if (item.includes("=")) {
      const [key, ...rest] = item.split("=");
      options.set(key, rest.join("="));
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(item, next);
      index += 1;
    } else {
      flags.add(item);
    }
  }

  return { flags, options };
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeAudioFile(filePath, buffer) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

async function generateSpeech({ apiKey, baseUrl, voiceId, modelId, outputFormat, text, voiceSettings }) {
  const body = {
    text,
    model_id: modelId
  };
  if (voiceSettings && Object.keys(voiceSettings).length) {
    body.voice_settings = voiceSettings;
  }

  const response = await fetch(`${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`ElevenLabs request failed (${response.status} ${response.statusText})${details ? `: ${details}` : ""}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const { flags, options } = parseArgs(process.argv);
  const pack = await readJson(packPath);
  const hostManifest = await readJson(hostManifestPath);
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const baseUrl = String(process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
  const modelId = String(process.env.ELEVENLABS_MODEL_ID || hostManifest.modelId || "eleven_multilingual_v2").trim();
  const outputFormat = String(process.env.ELEVENLABS_OUTPUT_FORMAT || hostManifest.outputFormat || "mp3_44100_128").trim();
  const defaultVoiceSettings = hostManifest.voiceSettings || {};
  const defaultVoiceId = String(hostManifest.voiceId || process.env[hostManifest.voiceIdEnv || "ELEVENLABS_VOICE_ID"] || "").trim();
  const dryRun = flags.has("--dry-run");
  const overwrite = flags.has("--overwrite");
  const matchText = String(options.get("--match") || "").trim();

  const questions = (pack.questions || []).filter(question => {
    if (matchText && !`${question.id || ""} ${question.question || ""} ${question.category || ""}`.includes(matchText)) return false;
    return true;
  });

  console.log(`Generating ${questions.length} question title audio file(s)`);
  console.log(`Pack: ${pack.id || "core"}`);
  console.log(`Model: ${modelId}`);
  console.log(`Output format: ${outputFormat}`);

  for (const question of questions) {
    const outputPath = path.join(projectRoot, "public", String(question.questionAudio || "").replace(/^\//, ""));
    const message = `[${question.id || "question"}] ${path.basename(outputPath)}`;
    const text = prepareVoiceText(question.question);

    if (!text) {
      throw new Error(`${message}: missing question text`);
    }

    if (!String(question.questionAudio || "").trim()) {
      throw new Error(`${message}: missing questionAudio path`);
    }

    try {
      await stat(outputPath);
      if (!overwrite) {
        console.log(`${message}: skipped (already exists)`);
        continue;
      }
    } catch {}

    if (dryRun) {
      console.log(`${message}: dry run`);
      continue;
    }

    const voiceId = String(question.voiceId || defaultVoiceId).trim();
    if (!voiceId) {
      throw new Error(`${message}: missing voice id`);
    }

    console.log(`${message}: generating`);
    const audio = await generateSpeech({
      apiKey,
      baseUrl,
      voiceId,
      modelId,
      outputFormat,
      text,
      voiceSettings: question.voiceSettings || defaultVoiceSettings
    });
    await writeAudioFile(outputPath, audio);
    console.log(`${message}: wrote ${formatBytes(audio.length)}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

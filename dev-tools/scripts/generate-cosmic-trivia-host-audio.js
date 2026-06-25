import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareVoiceText } from "../server/voice-library/text.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "content", "games", "cosmic-trivia", "audio", "tts-manifest.json");

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

function audioPathToOutputPath(audioPath = "") {
  const clean = String(audioPath || "").replace(/^\/+/, "");
  if (!clean) return "";
  return path.join(projectRoot, "public", clean.replace(/^games\//, ""));
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
  const manifest = await readJson(manifestPath);
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const baseUrl = String(process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
  const modelId = String(process.env.ELEVENLABS_MODEL_ID || manifest.modelId || "eleven_multilingual_v2").trim();
  const outputFormat = String(process.env.ELEVENLABS_OUTPUT_FORMAT || manifest.outputFormat || "mp3_44100_128").trim();
  const defaultVoiceSettings = manifest.voiceSettings || {};
  const defaultVoiceId = String(manifest.voiceId || process.env[manifest.voiceIdEnv || "ELEVENLABS_VOICE_ID"] || "").trim();
  const dryRun = flags.has("--dry-run");
  const overwrite = flags.has("--overwrite");
  const cuePrefix = String(options.get("--cue-prefix") || options.get("--phase-prefix") || "").trim();
  const excludePhasePrefix = String(options.get("--exclude-phase-prefix") || "").trim();
  const filePrefix = String(options.get("--file-prefix") || "").trim();
  const matchText = String(options.get("--match") || "").trim();

  const selectedFiles = manifest.files.filter(entry => {
    const cueKey = String(entry.cueKey || "");
    const phaseKey = String(entry.phase || "");
    if (cuePrefix && !(cueKey.startsWith(cuePrefix) || phaseKey.startsWith(cuePrefix))) return false;
    if (excludePhasePrefix && (cueKey.startsWith(excludePhasePrefix) || phaseKey.startsWith(excludePhasePrefix))) return false;
    if (filePrefix && !String(entry.fileName || "").startsWith(filePrefix)) return false;
    if (entry.active === false) return false;
    if (matchText && !`${entry.cueKey || ""} ${entry.phase || ""} ${entry.fileName || ""} ${entry.text || ""}`.includes(matchText)) return false;
    return true;
  });

  console.log(`Generating ${selectedFiles.length} audio file(s)`);
  console.log(`Model: ${modelId}`);
  console.log(`Output format: ${outputFormat}`);
  console.log(`Output root: ${manifest.outputRoot || manifest.outputDir || ""}`);

  for (const entry of selectedFiles) {
    const outputPath = audioPathToOutputPath(entry.audioPath || "");
    const message = `[${entry.cueKey || entry.phase || "unknown"}] ${entry.fileName}`;

    const text = prepareVoiceText(entry.text);

    if (!text) {
      throw new Error(`${message}: missing text`);
    }
    if (!outputPath) {
      throw new Error(`${message}: missing audioPath`);
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

    console.log(`${message}: generating`);
    const voiceId = String(entry.voiceId || defaultVoiceId).trim();
    if (!voiceId) {
      throw new Error(`${message}: missing voice id`);
    }
    const audio = await generateSpeech({
      apiKey,
      baseUrl,
      voiceId,
      modelId,
      outputFormat,
      text,
      voiceSettings: entry.voiceSettings || defaultVoiceSettings
    });
    await writeAudioFile(outputPath, audio);
    console.log(`${message}: wrote ${formatBytes(audio.length)}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

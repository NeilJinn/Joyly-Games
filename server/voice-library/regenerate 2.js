import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { splitVoiceText } from "./text.js";

function readStateEntity(stateMap, id) {
  return stateMap?.[id] || {};
}

function hasTestMarker(value) {
  return /test/i.test(String(value || ""));
}

function inferOutputPath(candidate) {
  if (candidate?.filePath) return candidate.filePath;
  if (candidate?.audioPath) {
    return path.join(process.cwd(), "public", String(candidate.audioPath).replace(/^\/+/, ""));
  }
  return null;
}

function splitOutputPath(basePath, segmentIndex) {
  if (segmentIndex <= 0) return basePath;
  const ext = path.extname(basePath);
  const dir = path.dirname(basePath);
  const stem = path.basename(basePath, ext);
  const match = stem.match(/^(.*?)(?:-(\d+))?$/);
  const prefix = match?.[1] || stem;
  const currentNumber = match?.[2] ? Number(match[2]) : null;
  const nextNumber = Number.isFinite(currentNumber) ? currentNumber + segmentIndex : segmentIndex + 1;
  return path.join(dir, `${prefix}-${String(nextNumber).padStart(2, "0")}${ext}`);
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

async function writeAudioFile(filePath, buffer) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

function collectTargets(catalog, reviewState) {
  const targets = [];

  for (const project of catalog?.projects || []) {
    for (const sectionName of ["director", "question"]) {
      for (const group of project.sections?.[sectionName] || []) {
        for (const candidate of group.candidates || []) {
          const candidateState = readStateEntity(reviewState?.candidates, candidate?.id);
          const tags = Array.isArray(candidateState.tags) ? candidateState.tags : [];
          const isRegenerate = tags.includes("regenerate") || candidateState.status === "regenerate";
          if (!isRegenerate) continue;
          targets.push({ group, candidate });
        }
      }
    }
  }

  return { targets };
}

function targetVoiceConfig(catalogTarget, voiceIdOverride = "") {
  const candidate = catalogTarget?.candidate || null;
  const group = catalogTarget?.group || null;
  const candidateVoiceId = String(candidate?.voiceId || "").trim();
  const candidateVoiceSettings = candidate?.voiceSettings || null;
  const candidateModelId = String(candidate?.modelId || "").trim();
  const sourceVoiceId = String(group?.source?.voiceId || "").trim();
  const sourceVoiceSettings = group?.source?.voiceSettings || null;
  const sourceModelId = String(group?.source?.modelId || "").trim();
  const overrideVoiceId = String(voiceIdOverride || "").trim();

  return {
    voiceId: overrideVoiceId || candidateVoiceId || sourceVoiceId || "",
    voiceSettings: candidateVoiceSettings || sourceVoiceSettings || null,
    modelId: candidateModelId || sourceModelId || ""
  };
}

function targetText(catalogTarget, reviewState) {
  const candidate = catalogTarget?.candidate || null;
  const candidateState = readStateEntity(reviewState?.candidates, candidate?.id);
  const rawText = candidateState.transcript || candidate?.text || candidate?.label || candidate?.title || candidate?.fileName || "";
  const segments = splitVoiceText(rawText);
  if (!segments.length) return "";
  return segments.join(" // ");
}

function shouldSkipTarget(catalogTarget) {
  const candidate = catalogTarget?.candidate || null;
  const group = catalogTarget?.group || null;
  const text = [
    candidate?.id,
    candidate?.label,
    candidate?.title,
    candidate?.fileName,
    candidate?.text,
    group?.id,
    group?.title,
    group?.subtitle,
    group?.phase
  ].filter(Boolean).join(" ");
  return hasTestMarker(text);
}

export async function regenerateTaggedVoiceLibraryAudio({ catalog, reviewState, apiKey, baseUrl, modelId, outputFormat, voiceIdOverride = "" }) {
  const skipped = [];
  const { targets } = collectTargets(catalog, reviewState);
  const generated = [];

  for (const target of targets) {
    if (shouldSkipTarget(target)) {
      skipped.push({
        kind: "candidate",
        id: target.candidate.id,
        reason: "test-sample"
      });
      continue;
    }

    const outputPath = inferOutputPath(target.candidate);
    const { voiceId, voiceSettings, modelId: candidateModelId } = targetVoiceConfig(target, voiceIdOverride);
    const text = targetText(target, reviewState);

    if (!outputPath) {
      skipped.push({ kind: "candidate", id: target.candidate.id, reason: "missing-output-path" });
      continue;
    }
    if (!text) {
      skipped.push({ kind: "candidate", id: target.candidate.id, reason: "missing-text" });
      continue;
    }
    if (!voiceId) {
      skipped.push({ kind: "candidate", id: target.candidate.id, reason: "missing-voice-id" });
      continue;
    }

    const candidateState = readStateEntity(reviewState?.candidates, target.candidate.id);
    const rawSegments = splitVoiceText(candidateState.transcript || target.candidate?.text || target.candidate?.label || target.candidate?.title || target.candidate?.fileName || "");
    const segments = rawSegments.length ? rawSegments : (text ? [text] : []);
    const segmentFiles = [];

    for (let index = 0; index < segments.length; index += 1) {
      const segmentText = segments[index];
      if (!segmentText) continue;
      const segmentOutputPath = splitOutputPath(outputPath, index);
      const audio = await generateSpeech({
        apiKey,
        baseUrl,
        voiceId,
        modelId: candidateModelId || modelId,
        outputFormat,
        text: segmentText,
        voiceSettings
      });
      await writeAudioFile(segmentOutputPath, audio);
      segmentFiles.push({
        index,
        text: segmentText,
        outputPath: segmentOutputPath
      });
    }

    generated.push({
      kind: "candidate",
      id: target.candidate.id,
      groupId: target.group?.id || null,
      outputPath,
      voiceId,
      text,
      segments,
      segmentFiles
    });
  }

  return {
    generated,
    skipped
  };
}

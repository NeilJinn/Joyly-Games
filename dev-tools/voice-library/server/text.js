function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function splitVoiceText(value) {
  return String(value || "")
    .split("//")
    .map(segment => normalizeText(segment))
    .filter(Boolean);
}

export function joinVoiceSegments(segments = []) {
  return segments
    .map(segment => normalizeText(segment))
    .filter(Boolean)
    .join(" // ");
}

export function prepareVoiceText(value) {
  const segments = splitVoiceText(value);
  if (!segments.length) return "";
  if (segments.length === 1) return segments[0];
  return segments.join("\n\n");
}

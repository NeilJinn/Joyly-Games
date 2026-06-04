import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const avatarRoot = path.join(rootDir, "public", "assets", "avatars");
const sheetsPath = path.join(avatarRoot, "source", "sheets.json");
const avatarCategories = ["characters", "hats", "decorations"];

function normalizeKey(value = "") {
  return String(value)
    .replace(/\.png$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function words(value = "") {
  return normalizeKey(value)
    .split("-")
    .filter(Boolean);
}

function parseAvatarKey(id = "") {
  const normalized = normalizeKey(id);
  const match = normalized.match(/^(character|charac|hat|decoration|dec)-(\d+)-(.*)$/);
  if (!match) return null;
  const prefix = match[1];
  const category = prefix === "character" || prefix === "charac"
    ? "characters"
    : prefix === "hat"
      ? "hats"
      : "decorations";
  return {
    category,
    index: Number(match[2]),
    slug: match[3] || ""
  };
}

function titleFromId(id = "") {
  const normalized = normalizeKey(id);
  const parsed = parseAvatarKey(normalized);
  return (parsed?.slug || normalized)
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function loadSheetMetadata() {
  if (!existsSync(sheetsPath)) {
    return Object.fromEntries(avatarCategories.map(category => [category, {
      byId: new Map(),
      byIndex: new Map(),
      items: []
    }]));
  }

  const data = JSON.parse(readFileSync(sheetsPath, "utf8"));
  const metadata = Object.fromEntries(avatarCategories.map(category => [category, {
    byId: new Map(),
    byIndex: new Map(),
    items: []
  }]));

  for (const sheet of data.sheets || []) {
    if (!avatarCategories.includes(sheet.category)) continue;
    for (const item of sheet.items || []) {
      const parsed = parseAvatarKey(item.id);
      const entry = {
        id: item.id,
        category: sheet.category,
        nameZh: item.nameZh || item.id,
        nameEn: item.nameEn || titleFromId(item.id)
      };
      metadata[sheet.category].byId.set(item.id, entry);
      if (parsed?.index) metadata[sheet.category].byIndex.set(parsed.index, entry);
      metadata[sheet.category].items.push(entry);
    }
  }

  return metadata;
}

function metadataScore(entry, slug = "") {
  const slugWords = words(slug);
  if (!slugWords.length) return 0;
  const entryWords = new Set([
    ...words(entry.id.replace(/^(character|hat|decoration)-\d+-/, "")),
    ...words(entry.nameEn)
  ]);
  let score = 0;
  for (const part of slugWords) {
    if (entryWords.has(part)) score += 2;
    else if ([...entryWords].some(word => word.startsWith(part) || part.startsWith(word))) score += 1;
  }
  return score;
}

function bestMetadataMatch(metadata, id, parsed) {
  if (metadata.byId.get(id)) return metadata.byId.get(id);
  if (parsed?.index && metadata.byIndex.get(parsed.index)) return metadata.byIndex.get(parsed.index);
  const slug = parsed?.slug || id;
  let best = null;
  let bestScore = 0;
  for (const entry of metadata.items) {
    const score = metadataScore(entry, slug);
    if (score <= bestScore) continue;
    best = entry;
    bestScore = score;
  }
  return best;
}

function scanCategory(category, metadata) {
  const dir = path.join(avatarRoot, category);
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".png"))
    .map(entry => entry.name.replace(/\.png$/, ""))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return entries.map(id => {
    const parsed = parseAvatarKey(id);
    const names = bestMetadataMatch(metadata, id, parsed) || {};
    const aliases = [names.id].filter(Boolean);
    return {
      id,
      category: category.slice(0, -1),
      src: `/assets/avatars/${category}/${id}.png`,
      nameZh: names.nameZh || id,
      nameEn: names.nameEn || titleFromId(id),
      aliases
    };
  });
}

export function getAvatarCatalog() {
  const metadata = loadSheetMetadata();
  return {
    characters: scanCategory("characters", metadata.characters),
    hats: scanCategory("hats", metadata.hats),
    decorations: scanCategory("decorations", metadata.decorations)
  };
}

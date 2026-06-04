import { getAvatarCatalog } from "./avatar-catalog.js";

const PALETTE_IDS = ["teal", "gold", "violet", "coral", "sky", "lime"];

function firstId(items = []) {
  return items[0]?.id || null;
}

function resolveCatalogId(items = [], rawId, fallback = null) {
  if (!rawId) return fallback;
  const match = items.find(item => item.id === rawId || item.aliases?.includes(rawId));
  return match?.id || fallback;
}

function coerceAvatar(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

function defaultAvatar(catalog = getAvatarCatalog()) {
  return {
    characterId: firstId(catalog.characters),
    hatId: firstId(catalog.hats),
    decorationId: firstId(catalog.decorations),
    paletteId: PALETTE_IDS[Math.floor(Math.random() * PALETTE_IDS.length)] || PALETTE_IDS[0]
  };
}

export function normalizeAvatarSelection(value, catalog = getAvatarCatalog()) {
  const raw = coerceAvatar(value);
  const defaults = defaultAvatar(catalog);

  const next = {
    characterId: resolveCatalogId(catalog.characters, raw.characterId, defaults.characterId),
    hatId: resolveCatalogId(catalog.hats, raw.hatId, null),
    decorationId: resolveCatalogId(catalog.decorations, raw.decorationId, null),
    paletteId: PALETTE_IDS.includes(raw.paletteId) ? raw.paletteId : defaults.paletteId
  };

  if (!next.hatId && defaults.hatId && !catalog.hats.length) next.hatId = null;
  if (!next.decorationId && defaults.decorationId && !catalog.decorations.length) next.decorationId = null;
  return next;
}

function pick(items, index, fallback = null) {
  return items[index % Math.max(items.length, 1)]?.id || fallback;
}

function buildTestPlayers() {
  const catalog = getAvatarCatalog();
  const defaults = defaultAvatar(catalog);
  const names = ["Test Nova", "Test Moon", "Test Comet", "Test Solar", "Test Crystal", "Test Desert", "Test Lagoon", "Test Rocket"];

  return names.map((nickname, index) => ({
    nickname,
    avatar: {
      characterId: pick(catalog.characters, index, defaults.characterId),
      hatId: pick(catalog.hats, index, null),
      decorationId: pick(catalog.decorations, index, null),
      paletteId: PALETTE_IDS[index % PALETTE_IDS.length]
    }
  }));
}

export const testPlayers = buildTestPlayers();

export function normalizePlayerProfile(value = {}) {
  return {
    nickname: String(value.nickname || "").trim().slice(0, 24),
    avatar: normalizeAvatarSelection(value.avatar)
  };
}

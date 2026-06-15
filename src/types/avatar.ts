export interface AvatarSelection {
  characterId: string | null;
  hatId: string | null;
  decorationId: string | null;
  paletteId: PaletteId;
}

export interface AvatarCatalogItem {
  id: string;
  category: "character" | "hat" | "decoration";
  src: string;
  nameEn: string;
  nameZh: string;
  aliases: string[];
}

export interface AvatarCatalog {
  characters: AvatarCatalogItem[];
  hats: AvatarCatalogItem[];
  decorations: AvatarCatalogItem[];
}

export const PALETTES = [
  { id: "teal",   fill: "#8be0d1", ring: "#f8fffd" },
  { id: "gold",   fill: "#ffd974", ring: "#fff9eb" },
  { id: "violet", fill: "#c7a0ff", ring: "#faf4ff" },
  { id: "coral",  fill: "#ff9f91", ring: "#fff3f1" },
  { id: "sky",    fill: "#95d7ff", ring: "#f1fbff" },
  { id: "lime",   fill: "#b6e875", ring: "#f8ffef" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export function paletteById(id: string) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function defaultAvatar(characterId: string | null): AvatarSelection {
  return { characterId, hatId: null, decorationId: null, paletteId: PALETTES[0].id };
}

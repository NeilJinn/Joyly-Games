export const BUILT_IN_MOTION_PACK_FILES = [
  "./builtins/card.entrance.json",
  "./builtins/card.flipReveal.json",
  "./builtins/impact.board.json",
  "./builtins/token.flyToTarget.json",
  "./builtins/victory.reveal.json"
];

export async function loadBuiltInMotionPacks() {
  const loaded = await Promise.all(
    BUILT_IN_MOTION_PACK_FILES.map(async file => {
      try {
        const response = await fetch(new URL(file, import.meta.url));
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    })
  );

  return loaded.filter(Boolean);
}

export async function seedBuiltInMotionPackRegistry(registry) {
  if (!registry || typeof registry.registerMotionPack !== "function") return [];

  const motionPacks = await loadBuiltInMotionPacks();
  const registered = [];
  for (const motionPack of motionPacks) {
    try {
      registered.push(registry.registerMotionPack(motionPack));
    } catch {
      // Skip invalid or duplicate built-ins.
    }
  }

  return registered;
}

export const CUE_PACKAGE_FILES = BUILT_IN_MOTION_PACK_FILES;
export const loadBuiltInCuePackages = loadBuiltInMotionPacks;
export const seedBuiltInCueRegistry = seedBuiltInMotionPackRegistry;

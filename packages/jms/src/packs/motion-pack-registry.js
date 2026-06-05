import {
  createMotionPackDraft,
  normalizeMotionPack,
  validateMotionPack
} from "./motion-pack-schema.js";

function cloneMotionPack(value) {
  if (value == null) return null;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function makeRegistryError(issues, motionPackId = "") {
  const error = new Error(
    motionPackId ? `Invalid motion pack "${motionPackId}"` : "Invalid motion pack"
  );
  error.name = "MotionPackRegistryError";
  error.issues = Array.isArray(issues) ? [...issues] : [];
  return error;
}

export function createMotionPackRegistry(seedMotionPacks = []) {
  const store = new Map();

  const api = {
    registerMotionPack(motionPack) {
      const result = validateMotionPack(motionPack);
      if (!result.valid || !result.motionPack) {
        throw makeRegistryError(result.errors, motionPack?.id || "");
      }

      store.set(result.motionPack.id, cloneMotionPack(result.motionPack));
      return cloneMotionPack(result.motionPack);
    },

    unregisterMotionPack(motionPackId) {
      return store.delete(String(motionPackId || "").trim());
    },

    getMotionPack(motionPackId) {
      const motionPack = store.get(String(motionPackId || "").trim());
      return motionPack ? cloneMotionPack(motionPack) : null;
    },

    listMotionPacks() {
      return [...store.values()].map(cloneMotionPack);
    },

    validateMotionPack(motionPack) {
      return validateMotionPack(motionPack);
    },

    loadMotionPack(source, { register = true } = {}) {
      let parsed = source;
      if (typeof source === "string") {
        try {
          parsed = JSON.parse(source);
        } catch (error) {
          return {
            valid: false,
            errors: ["Motion pack JSON could not be parsed"],
            motionPack: null,
            error
          };
        }
      }

      const result = validateMotionPack(parsed);
      if (result.valid && result.motionPack && register) {
        store.set(result.motionPack.id, cloneMotionPack(result.motionPack));
      }

      return result;
    },

    exportMotionPack(motionPackOrId, { pretty = true } = {}) {
      const motionPack = typeof motionPackOrId === "string"
        ? store.get(String(motionPackOrId || "").trim())
        : motionPackOrId;

      if (!motionPack) {
        throw makeRegistryError([`Motion pack "${String(motionPackOrId || "")}" was not found`], String(motionPackOrId || ""));
      }

      const normalized = normalizeMotionPack(motionPack, []);
      if (!normalized) {
        throw makeRegistryError([`Motion pack "${String(motionPackOrId || "")}" is not a valid package`], String(motionPackOrId || ""));
      }

      return JSON.stringify(normalized, null, pretty ? 2 : 0);
    },

    clear() {
      store.clear();
    }
  };

  for (const motionPack of seedMotionPacks) {
    try {
      api.registerMotionPack(motionPack);
    } catch {
      // Skip invalid seeds so one bad package doesn't break the registry.
    }
  }

  return api;
}

export const motionPackRegistry = createMotionPackRegistry();
export const defaultMotionPackDraft = createMotionPackDraft();

export const createCueRegistry = createMotionPackRegistry;
export const cueRegistry = motionPackRegistry;
export const defaultCuePackageDraft = defaultMotionPackDraft;

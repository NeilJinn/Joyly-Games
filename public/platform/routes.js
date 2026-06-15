export const MARKETING_SURFACES = new Set(["home", "games", "how-to-play", "support", "company"]);

export function surfaceFromPath(pathname = "/") {
  const normalized = normalizePathname(pathname);
  if (normalized === "/games") return "games";
  if (normalized === "/how-to-play") return "how-to-play";
  if (normalized === "/support") return "support";
  if (normalized === "/company") return "company";
  return "home";
}

export function pathFromSurface(surface = "home") {
  if (surface === "games") return "/games";
  if (surface === "how-to-play") return "/how-to-play";
  if (surface === "support") return "/support";
  if (surface === "company") return "/company";
  return "/";
}

export function isMarketingSurface(surface) {
  return MARKETING_SURFACES.has(surface);
}

function normalizePathname(pathname) {
  const clean = String(pathname || "/").trim() || "/";
  if (clean === "/") return clean;
  return clean.endsWith("/") ? clean.slice(0, -1) : clean;
}

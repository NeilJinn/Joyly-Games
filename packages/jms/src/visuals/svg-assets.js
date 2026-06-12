function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rankUpArrow({ title = "Rank up", className = "jms-rank-arrow" } = {}) {
  return `
    <svg class="${escapeAttribute(className)}" viewBox="0 0 64 64" role="img" aria-label="${escapeAttribute(title)}">
      <path class="jms-rank-arrow-shadow" d="M17 34 L32 20 L47 34" />
      <path class="jms-rank-arrow-main" d="M17 27 L32 13 L47 27" />
      <path class="jms-rank-arrow-stem" d="M32 16 L32 49" />
    </svg>
  `;
}

export const svgAssetLibrary = {
  "rank.arrow.up": {
    id: "rank.arrow.up",
    name: "Rank Up Arrow",
    category: "leaderboard",
    description: "Reusable upward rank movement arrow with layered stroke paths.",
    defaultClassName: "jms-rank-arrow",
    render: rankUpArrow
  }
};

export function getSvgAsset(assetId) {
  return svgAssetLibrary[String(assetId || "").trim()] || null;
}

export function listSvgAssets() {
  return Object.values(svgAssetLibrary).map(({ render, ...asset }) => ({ ...asset }));
}

export function renderSvgAsset(assetId, options = {}) {
  const asset = getSvgAsset(assetId);
  if (!asset) return "";
  return asset.render({
    className: asset.defaultClassName,
    ...options
  });
}

export function mountSvgAsset(target, assetId, options = {}) {
  const hasDomElement = typeof Element !== "undefined" && target instanceof Element;
  const hasSvgElement = typeof SVGElement !== "undefined" && target instanceof SVGElement;
  const element = hasDomElement || hasSvgElement
    ? target
    : typeof document !== "undefined"
      ? document.querySelector(String(target || ""))
      : null;
  if (!element) return null;
  const markup = renderSvgAsset(assetId, options);
  if (!markup) return null;
  element.innerHTML = markup;
  return element.firstElementChild;
}

export function rankUpArrowSvg(options = {}) {
  return renderSvgAsset("rank.arrow.up", options);
}

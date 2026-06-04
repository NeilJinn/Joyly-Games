import { escape, html } from "../platform/shared/ui.js";

export const PALETTES = [
  { id: "teal", name: "Teal", fill: "#8be0d1", accent: "#1a8e83", ring: "#f8fffd" },
  { id: "gold", name: "Gold", fill: "#ffd974", accent: "#d28b16", ring: "#fff9eb" },
  { id: "violet", name: "Violet", fill: "#c7a0ff", accent: "#7f58d8", ring: "#faf4ff" },
  { id: "coral", name: "Coral", fill: "#ff9f91", accent: "#e25d43", ring: "#fff3f1" },
  { id: "sky", name: "Sky", fill: "#95d7ff", accent: "#2b8dcc", ring: "#f1fbff" },
  { id: "lime", name: "Lime", fill: "#b6e875", accent: "#62982d", ring: "#f8ffef" }
];

let avatarCatalog = { characters: [], hats: [], decorations: [] };
const AVATAR_STEPS = [
  { id: "characterId", title: "Character" },
  { id: "hatId", title: "Hat" },
  { id: "decorationId", title: "Decoration" }
];

function paletteById(id) {
  return PALETTES.find(palette => palette.id === id) || PALETTES[0];
}

function itemsFor(field) {
  return ({
    characterId: avatarCatalog.characters,
    hatId: avatarCatalog.hats,
    decorationId: avatarCatalog.decorations
  })[field] || [];
}

function firstId(items = []) {
  return items[0]?.id || null;
}

function resolveCatalogId(items = [], rawId, fallback = null) {
  if (!rawId) return fallback;
  const match = items.find(item => item.id === rawId || item.aliases?.includes(rawId));
  return match?.id || fallback;
}

function randomPaletteId() {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)]?.id || PALETTES[0].id;
}

function randomId(items = []) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)]?.id || null;
}

function parseAvatar(value) {
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

export function setAvatarCatalog(nextCatalog = {}) {
  avatarCatalog = {
    characters: Array.isArray(nextCatalog.characters) ? nextCatalog.characters : [],
    hats: Array.isArray(nextCatalog.hats) ? nextCatalog.hats : [],
    decorations: Array.isArray(nextCatalog.decorations) ? nextCatalog.decorations : []
  };
}

export function getAvatarCatalog() {
  return avatarCatalog;
}

export function defaultAvatarSelection() {
  return {
    characterId: firstId(avatarCatalog.characters),
    hatId: firstId(avatarCatalog.hats),
    decorationId: firstId(avatarCatalog.decorations),
    paletteId: PALETTES[0].id
  };
}

export function normalizeAvatarSelection(value) {
  const raw = parseAvatar(value);
  const defaults = defaultAvatarSelection();

  return {
    characterId: resolveCatalogId(avatarCatalog.characters, raw.characterId, defaults.characterId),
    hatId: resolveCatalogId(avatarCatalog.hats, raw.hatId, null),
    decorationId: resolveCatalogId(avatarCatalog.decorations, raw.decorationId, null),
    paletteId: PALETTES.some(palette => palette.id === raw.paletteId) ? raw.paletteId : defaults.paletteId
  };
}

export function serializeAvatarSelection(value) {
  return JSON.stringify(normalizeAvatarSelection(value));
}

function itemById(field, id) {
  return itemsFor(field).find(item => item.id === id) || null;
}

function avatarAssetChoice(field, selectedId, item) {
  return html`
    <button
      class="avatar-choice-card ${selectedId === item.id ? "active" : ""}"
      type="button"
      data-avatar-field="${field}"
      data-avatar-value="${escape(item.id)}"
      aria-pressed="${selectedId === item.id ? "true" : "false"}"
    >
      <span class="avatar-choice-art ${field}">
        <img src="${escape(item.src)}" alt="${escape(item.nameEn)}" loading="lazy" />
      </span>
    </button>
  `;
}

function noneChoice(field, selectedId) {
  return html`
    <button
      class="avatar-choice-card none ${!selectedId ? "active" : ""}"
      type="button"
      data-avatar-field="${field}"
      data-avatar-value=""
      aria-pressed="${!selectedId ? "true" : "false"}"
    >
      <span class="avatar-choice-art avatar-choice-empty ${field}"></span>
    </button>
  `;
}

function stepTab(stepId, title, activeStep) {
  const active = stepId === activeStep;
  return html`
    <button
      class="avatar-step-tab ${active ? "active" : ""}"
      type="button"
      data-avatar-step-target="${stepId}"
      aria-pressed="${active ? "true" : "false"}"
    >${title}</button>
  `;
}

function choiceSection(title, field, selectedId, items, activeStep, allowNone = false) {
  return html`
    <section class="avatar-choice-group ${field === activeStep ? "active" : ""}" data-avatar-step-panel="${field}">
      <div class="avatar-choice-head">
        <h2>${title}</h2>
        <span>${items.length}${allowNone ? " + none" : ""}</span>
      </div>
      <div class="avatar-choice-grid">
        ${allowNone ? noneChoice(field, selectedId) : ""}
        ${items.map(item => avatarAssetChoice(field, selectedId, item)).join("")}
      </div>
    </section>
  `;
}

export function avatarToken(value, size = "normal", options = {}) {
  const avatar = normalizeAvatarSelection(value);
  const palette = paletteById(avatar.paletteId);
  const character = itemById("characterId", avatar.characterId);
  const hat = itemById("hatId", avatar.hatId);
  const decoration = itemById("decorationId", avatar.decorationId);
  const statuses = options.statuses || [];
  const ringColor = options.ringColor || palette.ring;

  return html`
    <div
      class="avatar-stack ${size}"
      style="--avatar-fill:${palette.fill};--avatar-accent:${palette.accent};--avatar-ring:${ringColor};"
    >
      <span class="avatar-core">
        <span class="avatar-core-fill"></span>
        ${character ? `<img class="avatar-layer avatar-character" src="${escape(character.src)}" alt="${escape(character.nameEn)}" />` : ""}
      </span>
      ${hat ? `<img class="avatar-layer avatar-hat" src="${escape(hat.src)}" alt="${escape(hat.nameEn)}" />` : ""}
      ${decoration ? `<img class="avatar-layer avatar-decoration" src="${escape(decoration.src)}" alt="${escape(decoration.nameEn)}" />` : ""}
      <span class="avatar-ring"></span>
      ${statuses.map(status => `<span class="avatar-status ${escape(status)}"></span>`).join("")}
    </div>
  `;
}

export function avatarEditor(value = null) {
  const avatar = normalizeAvatarSelection(value || { paletteId: randomPaletteId() });
  const activeStep = "characterId";
  return html`
    <section class="avatar-composer" data-avatar-editor data-avatar-active-step="${activeStep}">
      <input type="hidden" name="avatar" value="${escape(serializeAvatarSelection(avatar))}" data-avatar-input />
      <div class="avatar-editor-actions">
        <button class="ghost btn-action avatar-randomize" type="button" data-avatar-randomize>Randomize</button>
        <button class="secondary btn-action" type="button" data-avatar-submit>Done</button>
      </div>
      <div class="avatar-step-tabs" role="tablist" aria-label="Avatar categories">
        ${AVATAR_STEPS.map(step => stepTab(step.id, step.title, activeStep)).join("")}
      </div>
      <div class="avatar-preview-card">
        <div class="avatar-preview-stage" data-avatar-preview>${avatarToken(avatar, "hero")}</div>
        <div class="avatar-preview-copy compact">
          <strong data-avatar-step-title>Choose character</strong>
        </div>
      </div>
      <div class="avatar-step-panels">
        ${choiceSection("Character", "characterId", avatar.characterId, avatarCatalog.characters, activeStep)}
        ${choiceSection("Hat", "hatId", avatar.hatId, avatarCatalog.hats, activeStep, true)}
        ${choiceSection("Decoration", "decorationId", avatar.decorationId, avatarCatalog.decorations, activeStep, true)}
      </div>
    </section>
  `;
}

function randomAvatarSelection() {
  return normalizeAvatarSelection({
    characterId: randomId(avatarCatalog.characters),
    hatId: randomId(avatarCatalog.hats),
    decorationId: randomId(avatarCatalog.decorations),
    paletteId: randomPaletteId()
  });
}

function stepIndex(stepId) {
  return Math.max(0, AVATAR_STEPS.findIndex(step => step.id === stepId));
}

function activeStep(editor) {
  return editor.dataset.avatarActiveStep || AVATAR_STEPS[0].id;
}

function setActiveStep(editor, stepId) {
  const fallback = AVATAR_STEPS[0].id;
  const nextStep = AVATAR_STEPS.some(step => step.id === stepId) ? stepId : fallback;
  editor.dataset.avatarActiveStep = nextStep;
}

function refreshStepUI(editor) {
  const stepId = activeStep(editor);
  const index = stepIndex(stepId);
  const title = AVATAR_STEPS[index]?.title || "Character";
  const titleNode = editor.querySelector("[data-avatar-step-title]");

  if (titleNode) titleNode.textContent = `Choose ${title.toLowerCase()}`;

  editor.querySelectorAll("[data-avatar-step-panel]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.avatarStepPanel === stepId);
  });

  editor.querySelectorAll("[data-avatar-step-target]").forEach(button => {
    const active = button.dataset.avatarStepTarget === stepId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function syncEditor(editor, nextValue) {
  const avatar = normalizeAvatarSelection(nextValue);
  const input = editor.querySelector("[data-avatar-input]");
  const preview = editor.querySelector("[data-avatar-preview]");

  if (input) input.value = serializeAvatarSelection(avatar);
  if (preview) preview.innerHTML = avatarToken(avatar, "hero");

  editor.querySelectorAll("[data-avatar-field]").forEach(button => {
    const field = button.dataset.avatarField;
    const value = button.dataset.avatarValue || "";
    const active = String(avatar[field] || "") === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  refreshStepUI(editor);
}

function currentEditorValue(editor) {
  return parseAvatar(editor.querySelector("[data-avatar-input]")?.value);
}

export function bindAvatarEditors(root = document) {
  root.querySelectorAll("[data-avatar-editor]").forEach(editor => {
    if (editor.dataset.boundAvatarEditor === "true") return;
    editor.dataset.boundAvatarEditor = "true";
    setActiveStep(editor, activeStep(editor));
    syncEditor(editor, currentEditorValue(editor));
    editor.addEventListener("click", event => {
      const button = event.target.closest("[data-avatar-field]");
      if (button && editor.contains(button)) {
        event.preventDefault();
        const field = button.dataset.avatarField;
        const next = {
          ...currentEditorValue(editor),
          [field]: button.dataset.avatarValue || null
        };
        syncEditor(editor, next);
        return;
      }

      const tab = event.target.closest("[data-avatar-step-target]");
      if (tab && editor.contains(tab)) {
        event.preventDefault();
        setActiveStep(editor, tab.dataset.avatarStepTarget);
        refreshStepUI(editor);
        return;
      }

      const randomize = event.target.closest("[data-avatar-randomize]");
      if (randomize && editor.contains(randomize)) {
        event.preventDefault();
        syncEditor(editor, randomAvatarSelection());
        refreshStepUI(editor);
        return;
      }

      const submit = event.target.closest("[data-avatar-submit]");
      if (submit && editor.contains(submit)) {
        event.preventDefault();
        const form = editor.closest("form");
        form?.requestSubmit();
      }
    });
  });
}

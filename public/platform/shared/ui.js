export function html(strings, ...values) {
  return strings.map((string, index) => `${string}${values[index] ?? ""}`).join("");
}

export function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

export function icon(name) {
  const paths = {
    play: `<polygon points="8 5 19 12 8 19 8 5"></polygon>`,
    login: `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path>`,
    home: `<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 10v10h14V10"></path>`,
    left: `<path d="M15 18l-6-6 6-6"></path>`,
    right: `<path d="M9 18l6-6-6-6"></path>`,
    door: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>`,
    users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`,
    game: `<rect x="3" y="7" width="18" height="10" rx="3"></rect><path d="M8 12h3"></path><path d="M9.5 10.5v3"></path><circle cx="16" cy="12" r=".5"></circle><circle cx="18" cy="10.5" r=".5"></circle>`,
    qr: `<rect x="3" y="3" width="6" height="6"></rect><rect x="15" y="3" width="6" height="6"></rect><rect x="3" y="15" width="6" height="6"></rect><path d="M15 15h2v2h-2z"></path><path d="M19 15h2v6h-6v-2"></path>`,
    copy: `<rect x="9" y="9" width="13" height="13" rx="2"></rect><rect x="2" y="2" width="13" height="13" rx="2"></rect>`,
    settings: `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1h.1a2 2 0 1 1 0 4H20a1.7 1.7 0 0 0-.6 1Z"></path>`,
    logout: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>`,
    close: `<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>`,
    power: `<path d="M12 2v10"></path><path d="M18.4 6.6a9 9 0 1 1-12.8 0"></path>`,
    card: `<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path>`,
    coins: `<circle cx="8" cy="8" r="5"></circle><path d="M13 6.5A5 5 0 1 1 10.5 15"></path><path d="M8 5.5v5"></path><path d="M6.5 7h3"></path>`,
    check: `<path d="M20 6 9 17l-5-5"></path>`,
    star: `<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"></path>`,
    trophy: `<path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"></path><path d="M5 5H3v2a4 4 0 0 0 4 4"></path><path d="M19 5h2v2a4 4 0 0 1-4 4"></path>`,
    music: `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>`,
    desktop: `<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path>`,
    mobile: `<rect x="7" y="2" width="10" height="20" rx="2"></rect><path d="M11 18h2"></path>`
  };
  return `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.play}</svg>`;
}

export function withIcon(name, label) {
  return `${icon(name)}<span>${label}</span>`;
}

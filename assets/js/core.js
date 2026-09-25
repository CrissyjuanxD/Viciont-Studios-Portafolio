// Utilidades compartidas entre la web pública y el panel de administración.

export const SECTION_KEYS = ['projects', 'plugins', 'mods'];

export const SECTION_META = {
  projects: { label: 'Proyecto', plural: 'Proyectos', icon: 'grid', code: 'PRJ', slug: 'proyecto', route: 'proyectos' },
  plugins: { label: 'Plugin', plural: 'Plugins', icon: 'plug', code: 'PLG', slug: 'plugin', route: 'plugins' },
  mods: { label: 'Mod', plural: 'Mods', icon: 'cube', code: 'MOD', slug: 'mod', route: 'mods' },
};

export const SOCIAL_TYPES = {
  youtube: { label: 'YouTube', icon: 'youtube' },
  x: { label: 'X', icon: 'x' },
  twitch: { label: 'Twitch', icon: 'twitch' },
  tiktok: { label: 'TikTok', icon: 'tiktok' },
  instagram: { label: 'Instagram', icon: 'instagram' },
  discord: { label: 'Discord', icon: 'discord' },
  kick: { label: 'Kick', icon: 'kick' },
  github: { label: 'GitHub', icon: 'github' },
  web: { label: 'Web', icon: 'globe' },
};

// ---------- Iconos (SVG en línea) ----------
const BRAND = {
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  twitch: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
  tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  discord: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z',
  kick: 'M3 3h5v5h2V6h2V3h7v6h-2v2h-2v2h2v2h2v6h-7v-3h-2v-2h-2v-2H8v7H3z',
};

const UI = {
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  alert: '<path d="M12 3.5L22 20.5H2L12 3.5z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4"/>',
  cube: '<path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5L12 2.5z"/><path d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  home: '<path d="M3 11l9-7.5 9 7.5M5.5 9.5V20h13V9.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9L20 16M20 20v-4h-4"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13l9-9M16 7l2 2M14 9l2 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  dollar: '<path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.6 0-4.5 1.3-4.5 3.2 0 4.3 9.5 2.3 9.5 6.6 0 2-2 3.2-5 3.2-2.3 0-4-.8-4.9-2.2"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/>',
  verified: '<path d="M12 2.5l2.4 1.8 3-.2.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.9-2.4-1.8.9-2.9-.9-2.9 2.4-1.8.9-2.9 3 .2L12 2.5z"/><path d="M8.5 12l2.4 2.4 4.6-4.8"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
};

export function icon(name, cls = '') {
  const c = `i${cls ? ' ' + cls : ''}`;
  if (BRAND[name]) {
    return `<svg class="${c}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${BRAND[name]}"/></svg>`;
  }
  const body = UI[name] || UI.info;
  return `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Sustituye <i data-icon="nombre"></i> por su SVG.
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, el.className || '');
  });
}

// ---------- Texto seguro ----------
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

// Párrafos (línea en blanco), saltos de línea y **negrita**. Todo se escapa primero.
export function richText(text) {
  return bold(escapeHtml(text))
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Versión en una sola línea (para tarjetas con texto recortado).
export function inlineRich(text) {
  return bold(escapeHtml(text)).replace(/\s*\n+\s*/g, ' ').trim();
}

// ---------- URLs e imágenes ----------
export function safeUrl(value) {
  let s = String(value ?? '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (/^[\w-]+(\.[\w-]+)+/.test(s)) s = 'https://' + s;
    else return '';
  }
  try {
    const url = new URL(s);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* URL inválida */ }
  return '';
}

export function safeImage(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(s)) return s;
  if (/^https:\/\//i.test(s)) {
    try { return new URL(s).href; } catch { return ''; }
  }
  // Ruta relativa dentro del repositorio (p. ej. assets/uploads/foto.webp)
  if (/^[\w][\w\-./ %]*$/.test(s) && !s.includes('..')) return s;
  return '';
}

export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function handleFromUrl(url, type) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const first = parts[0] || '';
    if (type === 'youtube') {
      if (first.startsWith('@')) return first;
      if ((first === 'c' || first === 'channel' || first === 'user') && parts[1]) return parts[1];
    }
    if (['x', 'twitch', 'tiktok', 'instagram', 'kick', 'github'].includes(type) && first) {
      return first.startsWith('@') ? first : (type === 'github' || type === 'twitch' || type === 'kick' ? first : '@' + first);
    }
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '';
    const out = host + path;
    return out.length > 38 ? out.slice(0, 36) + '…' : out;
  } catch {
    return url;
  }
}

// ---------- Varios ----------
export const pad2 = (n) => String(n).padStart(2, '0');

export function initials(name) {
  const clean = String(name || '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim();
  if (!clean) return '?';
  const words = clean.split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0];
  const caps = w.match(/\p{Lu}/gu);
  if (caps && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase();
  return w.slice(0, 2).toUpperCase();
}

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';
}

export function uid(prefix = 'id') {
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}${rnd}`;
}

export const deepClone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

// Portada por defecto (cuando una tarjeta no tiene imagen).
export function coverHTML(title, index = 0, code = '', emblemSrc = 'assets/img/emblem-160.webp') {
  return `<div class="cover cover--${index % 3}" aria-hidden="true">
    <div class="cover__grid"></div>
    <div class="cover__orb"></div>
    <img class="cover__emblem" src="${escapeHtml(emblemSrc)}" alt="" loading="lazy" decoding="async">
    <span class="cover__title">${escapeHtml(title || 'Viciont Studios')}</span>
    ${code ? `<span class="cover__code">${escapeHtml(code)}</span>` : ''}
    <span class="cover__corner cover__corner--tl"></span><span class="cover__corner cover__corner--tr"></span>
  </div>`;
}

// ---------- Normalización del contenido ----------
// Garantiza que el JSON siempre tenga la forma esperada, aunque venga incompleto.
const str = (v, d = '') => (typeof v === 'string' ? v : v == null ? d : String(v));
const list = (v) => (Array.isArray(v) ? v : []);
const lines = (v) => {
  if (typeof v === 'string') return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  return list(v).map((s) => str(s).trim()).filter(Boolean);
};

function normalizeMember(m, i) {
  const o = m && typeof m === 'object' ? m : {};
  return {
    id: str(o.id) || `m-${i + 1}`,
    name: str(o.name, 'Miembro'),
    role: str(o.role),
    description: str(o.description),
    avatar: str(o.avatar),
    hidden: Boolean(o.hidden),
    socials: list(o.socials)
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({ type: SOCIAL_TYPES[s.type] ? s.type : 'web', url: str(s.url).trim() })),
  };
}

function normalizeItem(it, i) {
  const o = it && typeof it === 'object' ? it : {};
  return {
    id: str(o.id) || `item-${i + 1}`,
    title: str(o.title, 'Sin título'),
    badge: str(o.badge),
    tags: lines(o.tags),
    description: str(o.description),
    image: str(o.image),
    link: str(o.link).trim(),
    linkLabel: str(o.linkLabel),
    hidden: Boolean(o.hidden),
  };
}

const DEFAULT_TITLES = { projects: 'Proyectos', plugins: 'Plugins', mods: 'Mods' };

export function normalizeContent(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const site = c.site || {};
  const team = c.team || {};
  const contact = c.contact || {};
  const out = {
    meta: {
      version: Number(c.meta?.version) || 1,
      updatedAt: str(c.meta?.updatedAt),
      updatedBy: str(c.meta?.updatedBy),
    },
    site: {
      name: str(site.name, 'Viciont Studios'),
      founder: str(site.founder, 'CrissyjuanxD'),
      kicker: str(site.kicker),
      tagline: str(site.tagline),
      typing: lines(site.typing),
      ticker: lines(site.ticker),
    },
    socials: {
      youtube: str(c.socials?.youtube).trim(),
      x: str(c.socials?.x).trim(),
      discord: str(c.socials?.discord).trim(),
    },
    about: { title: str(c.about?.title, 'Sobre nosotros'), text: str(c.about?.text) },
    team: {
      title: str(team.title, 'Miembros del Team'),
      subtitle: str(team.subtitle),
      members: list(team.members).map(normalizeMember),
    },
    sections: {},
    contact: {
      title: str(contact.title, 'Contáctanos'),
      text: str(contact.text),
      email: str(contact.email).trim(),
      priceRange: str(contact.priceRange),
      priceNote: str(contact.priceNote),
      services: lines(contact.services),
    },
    footer: { description: str(c.footer?.description), credit: str(c.footer?.credit, 'CrissyjuanxD') },
  };
  for (const key of SECTION_KEYS) {
    const s = c.sections?.[key] || {};
    out.sections[key] = {
      title: str(s.title, DEFAULT_TITLES[key]),
      intro: str(s.intro),
      items: list(s.items).map(normalizeItem),
    };
  }
  return out;
}

export const visible = (arr) => arr.filter((x) => !x.hidden);

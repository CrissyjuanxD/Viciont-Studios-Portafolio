// Panel de administración de Viciont Studios.
// Edita data/content.json y sube imágenes al repositorio mediante la API de GitHub.
import { CONFIG } from './config.js';
import {
  normalizeContent, SECTION_KEYS, SECTION_META, SOCIAL_TYPES, escapeHtml, safeUrl, safeImage,
  domainOf, icon, hydrateIcons, initials, coverHTML, slugify, deepClone,
} from './core.js';
import { GitHubClient, explainError } from './github.js';
import { createModal, toast, confirmDialog } from './ui.js';

// El panel nunca debe mostrarse dentro de otra página (protección contra clickjacking).
(() => {
  let framed = false;
  try { framed = window.top !== window.self && window.top.location.origin !== location.origin; } catch { framed = true; }
  if (framed) {
    document.documentElement.innerHTML = '';
    throw new Error('El panel no se puede mostrar dentro de otra página.');
  }
})();

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

hydrateIcons();

const REPO_KEY = `${CONFIG.owner}/${CONFIG.repo}`;
const TOKEN_KEY = `vs-admin-token:${REPO_KEY}`;
const DRAFT_KEY = `draft:${REPO_KEY}`;
const UPLOADS_KEY = `uploads:${REPO_KEY}`;
const SITE_ROOT = new URL('../', location.href).href;
const EMBLEM = '../assets/img/emblem-160.webp';
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const S = {
  gh: null,
  user: null,
  published: null,
  publishedSha: '',
  draft: null,
  pendingDraft: null,
  tab: 'general',
  uploads: new Map(), // ruta -> dataURL de imágenes recién subidas (mientras GitHub Pages despliega)
  publishing: false,
};

const modal = createModal();
const channel = (() => {
  try { return new BroadcastChannel(`vs-preview:${REPO_KEY}`); } catch { return null; }
})();
if (channel) channel.onmessage = (e) => { if (e.data?.type === 'hello' && S.draft) broadcast(); };

// ---------------------------------------------------------------- almacenamiento local

const idb = (() => {
  let dbp = null;
  const open = () => (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('viciont-admin', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k)).catch(() => undefined),
    set: (k, v) => run('readwrite', (s) => s.put(v, k)).catch(() => undefined),
    del: (k) => run('readwrite', (s) => s.delete(k)).catch(() => undefined),
  };
})();

function readToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function hasRememberedToken() {
  try { return Boolean(localStorage.getItem(TOKEN_KEY)); } catch { return false; }
}
function saveToken(token, remember) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (remember) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* almacenamiento bloqueado: el token queda solo en memoria */ }
}
function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch { /* nada que borrar */ }
}

// ---------------------------------------------------------------- utilidades

const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const keys = p.split('.');
  const last = keys.pop();
  const target = keys.reduce((a, k) => (a[k] ??= {}), o);
  target[last] = v;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
};
const fmtKB = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const listOf = (key) => (key === 'team' ? S.draft.team.members : S.draft.sections[key].items);
const nameOf = (key, x) => (key === 'team' ? x.name : x.title);

function uniqueId(key, base, exclude = null) {
  const used = new Set(listOf(key).filter((x) => x !== exclude).map((x) => x.id));
  const root = slugify(base);
  let id = root;
  for (let n = 2; used.has(id); n++) id = `${root}-${n}`;
  return id;
}

// Imagen para mostrar dentro del panel (el panel vive en /admin/).
function imgSrc(value) {
  const s = safeImage(value);
  if (!s) return '';
  if (s.startsWith('data:') || /^https:/i.test(s)) return s;
  return S.uploads.get(s) || new URL(s, SITE_ROOT).href;
}

function isDirty() {
  return S.draft && S.published && !same(normalizeContent(S.draft), S.published);
}

// ---------------------------------------------------------------- inicio

boot();

async function boot() {
  $('#repo-name').textContent = REPO_KEY;
  bindLogin();
  const token = readToken();
  if (!token) { showLogin(); return; }
  try {
    await login(token, { remember: hasRememberedToken() });
  } catch (err) {
    clearToken();
    showLogin(explainError(err));
  }
}

function showLogin(error = '') {
  $('#splash').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
  const box = $('#login-error');
  box.textContent = error;
  box.hidden = !error;
  setTimeout(() => $('#token').focus(), 60);
}

function bindLogin() {
  $('#toggle-token').addEventListener('click', () => {
    const input = $('#token');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('#token').value.trim();
    const box = $('#login-error');
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(token)) {
      box.textContent = 'Eso no parece un token de GitHub. Debe empezar por github_pat_ (o ghp_ si es un token clásico).';
      box.hidden = false;
      return;
    }
    const btn = $('#login-btn');
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh', 'spin')} Verificando…`;
    try {
      await login(token, { remember: $('#remember').checked });
      $('#token').value = '';
    } catch (err) {
      box.textContent = explainError(err);
      box.hidden = false;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('key')} Entrar al panel`;
    }
  });
}

async function login(token, { remember }) {
  const gh = new GitHubClient({ token, owner: CONFIG.owner, repo: CONFIG.repo, branch: CONFIG.branch });
  const user = await gh.user();
  const repo = await gh.repoInfo();
  if (repo.permissions && repo.permissions.push === false) {
    throw new Error(`La cuenta ${user.login} no tiene permiso de escritura en ${REPO_KEY}.`);
  }
  S.gh = gh;
  S.user = user;
  await loadRemote();
  saveToken(token, remember);
  showApp();
}

async function loadRemote() {
  const { sha, text } = await S.gh.getText(CONFIG.contentPath);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${CONFIG.contentPath} no es un JSON válido.`); }
  S.published = normalizeContent(json);
  S.publishedSha = sha;
  S.draft = deepClone(S.published);

  const cached = await idb.get(UPLOADS_KEY);
  if (cached && typeof cached === 'object') {
    const limit = Date.now() - 24 * 3600 * 1000;
    for (const [path, v] of Object.entries(cached)) if (v?.t > limit && v.d) S.uploads.set(path, v.d);
  }
  const saved = await idb.get(DRAFT_KEY);
  S.pendingDraft = saved?.content && !same(normalizeContent(saved.content), S.published) ? saved : null;
}

let appBound = false;
function showApp() {
  $('#splash').hidden = true;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#user-avatar').src = S.user.avatar_url || '';
  $('#user-avatar').hidden = !S.user.avatar_url;
  $('#user-name').textContent = S.user.login;
  if (!appBound) { bindApp(); appBound = true; }
  renderTabs();
  renderTab();
  updateStatus();
  broadcast();
  if (S.pendingDraft) offerDraftRestore(S.pendingDraft);
}

async function offerDraftRestore(saved) {
  S.pendingDraft = null;
  const outdated = saved.baseSha && saved.baseSha !== S.publishedSha;
  const ok = await confirmDialog(modal, {
    title: 'Tienes un borrador guardado',
    text: `Guardado el ${fmtDate(saved.savedAt)} en este navegador.${outdated ? ' Ojo: la web se publicó de nuevo después de ese borrador; si lo recuperas y publicas, reemplazarás esa versión.' : ''} ¿Quieres seguir con él?`,
    ok: 'Recuperar borrador',
    cancel: 'Empezar de cero',
  });
  if (ok) {
    S.draft = normalizeContent(saved.content);
    refresh();
  } else {
    await idb.del(DRAFT_KEY);
  }
}

// ---------------------------------------------------------------- estado y cambios

let saveTimer = 0;
function changed() {
  updateStatus();
  broadcast();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (isDirty()) idb.set(DRAFT_KEY, { content: S.draft, baseSha: S.publishedSha, savedAt: Date.now() });
    else idb.del(DRAFT_KEY);
  }, 400);
}

function refresh() {
  renderTabs();
  renderTab();
  changed();
}

function summarize(a, b) {
  const out = [];
  const push = (area, text, kind = 'mod') => out.push({ area, text, kind });
  if (!same(a.site, b.site)) push('General', 'Textos de la portada');
  if (!same(a.socials, b.socials)) push('General', 'Redes del estudio');
  if (!same(a.about, b.about)) push('Sobre nosotros', 'Texto de la sección');
  if (a.team.title !== b.team.title || a.team.subtitle !== b.team.subtitle) push('Equipo', 'Título o subtítulo');
  diffList(out, 'Equipo', a.team.members, b.team.members, (m) => m.name);
  for (const k of SECTION_KEYS) {
    const A = a.sections[k];
    const B = b.sections[k];
    const area = SECTION_META[k].plural;
    if (A.title !== B.title || A.intro !== B.intro) push(area, 'Título o introducción');
    diffList(out, area, A.items, B.items, (i) => i.title);
  }
  if (!same(a.contact, b.contact)) push('Contacto', 'Datos de contacto');
  if (!same(a.footer, b.footer)) push('Footer', 'Pie de página');
  return out;
}

function diffList(out, area, A, B, name) {
  const ai = new Map(A.map((x) => [x.id, x]));
  const bi = new Map(B.map((x) => [x.id, x]));
  for (const x of B) if (!ai.has(x.id)) out.push({ area, kind: 'add', text: `Añadido: ${name(x)}` });
  for (const x of A) if (!bi.has(x.id)) out.push({ area, kind: 'del', text: `Eliminado: ${name(x)}` });
  for (const x of B) {
    const o = ai.get(x.id);
    if (o && !same(o, x)) out.push({ area, kind: 'mod', text: `Editado: ${name(x)}` });
  }
  const orderA = A.map((x) => x.id).filter((id) => bi.has(id)).join('|');
  const orderB = B.map((x) => x.id).filter((id) => ai.has(id)).join('|');
  if (orderA !== orderB) out.push({ area, kind: 'mod', text: 'Nuevo orden' });
}

function updateStatus() {
  const el = $('#status');
  const n = S.draft ? summarize(S.published, normalizeContent(S.draft)).length : 0;
  if (S.publishing) {
    el.className = 'status is-busy';
    el.innerHTML = `${icon('refresh', 'spin')}<span>Publicando…</span>`;
  } else if (n) {
    el.className = 'status is-dirty';
    el.innerHTML = `<span class="status__dot"></span><span>${n} ${n === 1 ? 'cambio sin publicar' : 'cambios sin publicar'}</span><button class="status__discard" type="button" data-top="discard">Descartar</button>`;
  } else {
    el.className = 'status is-clean';
    el.innerHTML = `${icon('check')}<span>Todo publicado</span>`;
  }
  $('#btn-publish').disabled = !n || S.publishing;
}

function previewContent() {
  const c = normalizeContent(S.draft);
  const fix = (v) => S.uploads.get(v) || v;
  c.team.members.forEach((m) => { m.avatar = fix(m.avatar); });
  SECTION_KEYS.forEach((k) => c.sections[k].items.forEach((it) => { it.image = fix(it.image); }));
  return c;
}

function broadcast() {
  if (!channel || !S.draft) return;
  try { channel.postMessage({ type: 'content', content: previewContent() }); } catch { /* sin vista previa */ }
}

// ---------------------------------------------------------------- pestañas

const TABS = [
  { id: 'general', label: 'General', icon: 'sliders' },
  { id: 'about', label: 'Sobre nosotros', icon: 'info' },
  { id: 'team', label: 'Equipo', icon: 'users', count: () => S.draft.team.members.length },
  { id: 'projects', label: 'Proyectos', icon: 'grid', count: () => S.draft.sections.projects.items.length },
  { id: 'plugins', label: 'Plugins', icon: 'plug', count: () => S.draft.sections.plugins.items.length },
  { id: 'mods', label: 'Mods', icon: 'cube', count: () => S.draft.sections.mods.items.length },
  { id: 'contact', label: 'Contacto y footer', icon: 'mail' },
  { id: 'history', label: 'Historial y seguridad', icon: 'history' },
];

function renderTabs() {
  $('#tabs').innerHTML = TABS.map((t) => `
    <button class="tab${S.tab === t.id ? ' is-active' : ''}" type="button" data-tab="${t.id}"${S.tab === t.id ? ' aria-current="page"' : ''}>
      ${icon(t.icon)}<span>${t.label}</span>${t.count ? `<small>${t.count()}</small>` : ''}
    </button>`).join('');
}

function renderTab() {
  const ws = $('#workspace');
  const k = S.tab;
  if (k === 'general') ws.innerHTML = tabGeneral();
  else if (k === 'about') ws.innerHTML = tabAbout();
  else if (k === 'team') ws.innerHTML = tabTeam();
  else if (SECTION_KEYS.includes(k)) ws.innerHTML = tabSection(k);
  else if (k === 'contact') ws.innerHTML = tabContact();
  else if (k === 'history') { ws.innerHTML = tabHistory(); loadHistory(); }
}

const wsHead = (title, text) => `<header class="ws-head"><h1 class="ws-head__title">${escapeHtml(title)}</h1><p class="ws-head__text">${text}</p></header>`;

function fText(path, label, { placeholder = '', hint = '', type = 'text', kind = '', maxlength = 200, required = false } = {}) {
  const v = getPath(S.draft, path) ?? '';
  const k = kind || (type === 'url' ? 'url' : type === 'email' ? 'email' : '');
  const invalid = v && ((k === 'url' && !safeUrl(v)) || (k === 'email' && !EMAIL_RE.test(v)));
  return `<label class="field">
    <span class="field__label">${escapeHtml(label)}${required ? ' <em>*</em>' : ''}</span>
    <input class="input${invalid ? ' is-invalid' : ''}" type="${type}" data-path="${path}"${k ? ` data-kind="${k}"` : ''} value="${escapeHtml(v)}" placeholder="${escapeHtml(placeholder)}" maxlength="${maxlength}"${type === 'url' ? ' inputmode="url"' : ''} spellcheck="${type === 'text'}">
    ${hint ? `<span class="field__hint">${hint}</span>` : ''}
  </label>`;
}

function fArea(path, label, { rows = 4, hint = '', placeholder = '', maxlength = 4000 } = {}) {
  const v = getPath(S.draft, path) ?? '';
  return `<label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <textarea class="input textarea" rows="${rows}" data-path="${path}" maxlength="${maxlength}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(v)}</textarea>
    ${hint ? `<span class="field__hint">${hint}</span>` : ''}
  </label>`;
}

function fLines(path, label, { rows = 5, hint = '' } = {}) {
  const v = getPath(S.draft, path) || [];
  return `<label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <textarea class="input textarea" rows="${rows}" data-path="${path}" data-kind="lines">${escapeHtml(v.join('\n'))}</textarea>
    ${hint ? `<span class="field__hint">${hint}</span>` : ''}
  </label>`;
}

function tabGeneral() {
  return `${wsHead('General', 'Todo lo que cambies aquí se guarda como <b>borrador</b> en este navegador. Nada llega a la web hasta que pulses <b>Publicar</b>.')}
  <section class="card-panel">
    <h2 class="card-panel__title">${icon('sparkle')} Cómo funciona</h2>
    <div class="guide">
      <div class="guide__step"><b><span class="guide__num">1</span> Edita</b>Cambia textos, imágenes, miembros o tarjetas en cualquier pestaña.</div>
      <div class="guide__step"><b><span class="guide__num">2</span> Revisa</b>Pulsa <em>Vista previa</em> para ver la web con tus cambios, en vivo, antes de publicarlos.</div>
      <div class="guide__step"><b><span class="guide__num">3</span> Publica</b>Pulsa <em>Publicar</em>: se guarda en GitHub y la web se actualiza en 1-2 minutos para todo el mundo.</div>
    </div>
  </section>
  <section class="card-panel">
    <h2 class="card-panel__title">${icon('home')} Portada</h2>
    <div class="grid-2">
      ${fText('site.name', 'Nombre del estudio', { required: true, maxlength: 60, hint: 'La primera palabra va arriba y el resto abajo (VICIONT / STUDIOS).' })}
      ${fText('site.founder', 'Creado por', { maxlength: 60 })}
      ${fText('site.kicker', 'Etiqueta superior', { placeholder: 'Estudio de Minecraft', maxlength: 60 })}
    </div>
    ${fArea('site.tagline', 'Frase principal', { rows: 2, maxlength: 240 })}
    <div class="grid-2">
      ${fLines('site.typing', 'Frases del efecto de escritura', { hint: 'Una por línea. Se escriben solas como en una terminal.' })}
      ${fLines('site.ticker', 'Palabras de la cinta animada', { hint: 'Una por línea. También salen en “¿Qué hacemos?”.' })}
    </div>
  </section>
  <section class="card-panel">
    <h2 class="card-panel__title">${icon('globe')} Redes del estudio</h2>
    <p class="field__hint">Son los iconos de YouTube, X y Discord de la barra de navegación y del footer. Si están vacías, al pulsarlas sale “disponible muy pronto”.</p>
    <div class="grid-2">
      ${fText('socials.youtube', 'YouTube', { type: 'url', placeholder: 'https://www.youtube.com/@ViciontStudios', maxlength: 300 })}
      ${fText('socials.x', 'X (Twitter)', { type: 'url', placeholder: 'https://x.com/ViciontStudios', maxlength: 300 })}
      ${fText('socials.discord', 'Discord', { type: 'url', placeholder: 'https://discord.gg/tu-invitacion', maxlength: 300, hint: 'Usa un enlace de invitación que no caduque.' })}
    </div>
  </section>`;
}

function tabAbout() {
  return `${wsHead('Sobre nosotros', 'El resumen del estudio que aparece en la página principal, dentro de la ventana tipo terminal.')}
  <section class="card-panel">
    ${fText('about.title', 'Título de la sección', { maxlength: 60, hint: 'También es el nombre en la barra de navegación.' })}
    ${fArea('about.text', 'Texto', { rows: 12, maxlength: 6000, hint: 'Deja una línea en blanco para separar párrafos. Escribe <b>**texto**</b> para ponerlo en negrita.' })}
  </section>`;
}

function tabTeam() {
  const list = S.draft.team.members;
  return `${wsHead('Equipo', 'Miembros del Team: foto, nombre, rol, descripción y redes. Arrastra las filas o usa las flechas para cambiar el orden.')}
  <section class="card-panel">
    <div class="grid-2">
      ${fText('team.title', 'Título', { maxlength: 60 })}
      ${fText('team.subtitle', 'Subtítulo', { maxlength: 160 })}
    </div>
  </section>
  <section class="card-panel">
    <div class="list-head">
      <h2 class="card-panel__title">${icon('users')} Miembros <small>${list.length}</small></h2>
      <button class="btn btn--sm btn--primary" type="button" data-action="add" data-list="team">${icon('plus')} Añadir miembro</button>
    </div>
    ${rowsHTML('team', list)}
  </section>`;
}

function tabSection(key) {
  const sec = S.draft.sections[key];
  const meta = SECTION_META[key];
  return `${wsHead(meta.plural, `Tarjetas de ${meta.plural.toLowerCase()}: imagen, título, descripción, etiquetas y un enlace opcional (si lo pones, la web avisa a dónde lleva antes de ir).`)}
  <section class="card-panel">
    <div class="grid-2">
      ${fText(`sections.${key}.title`, 'Título de la sección', { required: true, maxlength: 60, hint: 'También es el nombre en la barra de navegación.' })}
    </div>
    ${fArea(`sections.${key}.intro`, 'Introducción', { rows: 3, maxlength: 600 })}
  </section>
  <section class="card-panel">
    <div class="list-head">
      <h2 class="card-panel__title">${icon(meta.icon)} Tarjetas <small>${sec.items.length}</small></h2>
      <button class="btn btn--sm btn--primary" type="button" data-action="add" data-list="${key}">${icon('plus')} Añadir ${meta.label.toLowerCase()}</button>
    </div>
    ${rowsHTML(key, sec.items)}
  </section>`;
}

function tabContact() {
  return `${wsHead('Contacto y footer', 'Correo, precios y servicios de la sección de contacto, y los textos del pie de página.')}
  <section class="card-panel">
    <h2 class="card-panel__title">${icon('mail')} Contacto</h2>
    <div class="grid-2">
      ${fText('contact.title', 'Título de la sección', { maxlength: 60, hint: 'También es el nombre en la barra de navegación.' })}
      ${fText('contact.email', 'Correo', { type: 'email', maxlength: 120 })}
    </div>
    ${fArea('contact.text', 'Texto', { rows: 3, maxlength: 800 })}
    <div class="grid-2">
      ${fText('contact.priceRange', 'Rango de precios', { placeholder: '$20 – $100+ USD', maxlength: 60 })}
      ${fLines('contact.services', 'Servicios', { rows: 4, hint: 'Uno por línea. Salen como etiquetas, en el formulario y en el footer.' })}
    </div>
    ${fArea('contact.priceNote', 'Nota sobre los precios', { rows: 2, maxlength: 400 })}
  </section>
  <section class="card-panel">
    <h2 class="card-panel__title">${icon('file')} Footer</h2>
    ${fArea('footer.description', 'Descripción del estudio', { rows: 3, maxlength: 400 })}
    ${fText('footer.credit', 'Diseñado y desarrollado por', { maxlength: 60 })}
  </section>`;
}

function tabHistory() {
  return `${wsHead('Historial y seguridad', 'Cada vez que publicas se guarda una versión en GitHub. Puedes volver a cualquiera de ellas.')}
  <section class="card-panel">
    <div class="list-head">
      <h2 class="card-panel__title">${icon('history')} Versiones publicadas</h2>
      <button class="btn btn--sm btn--ghost" type="button" data-action="history-refresh">${icon('refresh')} Actualizar</button>
    </div>
    <div id="history-list"><p class="muted">Cargando…</p></div>
  </section>
  <section class="card-panel">
    <h2 class="card-panel__title">${icon('download')} Copia de seguridad</h2>
    <p class="field__hint">Descarga todo el contenido (incluido tu borrador) en un archivo .json, o carga uno que hayas guardado.</p>
    <div class="btn-row">
      <button class="btn btn--sm" type="button" data-action="export">${icon('download')} Exportar JSON</button>
      <label class="btn btn--sm btn--ghost">${icon('upload')} Importar JSON<input type="file" accept="application/json,.json" data-import hidden></label>
    </div>
  </section>
  <section class="card-panel">
    <h2 class="card-panel__title">${icon('shield')} Seguridad</h2>
    <ul class="tips">
      <li>Tu token ${hasRememberedToken() ? 'está guardado en este navegador porque activaste “Recordar”.' : 'solo vive en esta pestaña y se borra al cerrarla.'}</li>
      <li>Si usas un ordenador ajeno, pulsa <b>Cerrar sesión</b> al terminar.</li>
      <li>Para quitar el acceso a cualquier dispositivo, borra el token en <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener noreferrer">GitHub → Fine-grained tokens</a>.</li>
      <li>Nadie puede cambiar la web sin un token con permiso de escritura en <code>${escapeHtml(REPO_KEY)}</code>.</li>
    </ul>
  </section>`;
}

// ---------------------------------------------------------------- filas de listas

function rowsHTML(key, list) {
  if (!list.length) return `<div class="empty">${icon('sparkle')}<p>Todavía no hay nada aquí. Pulsa “Añadir”.</p></div>`;
  return `<ul class="rows" data-rows="${key}">${list.map((x, i) => rowHTML(key, x, i, list.length)).join('')}</ul>`;
}

function rowHTML(key, x, i, n) {
  const team = key === 'team';
  const raw = team ? x.avatar : x.image;
  const src = imgSrc(raw);
  const thumb = team
    ? `<span class="avatar row__avatar">${src ? `<img src="${escapeHtml(src)}" alt="">` : `<span class="avatar__initials">${escapeHtml(initials(x.name))}</span>`}</span>`
    : `<span class="row__thumb">${src ? `<img src="${escapeHtml(src)}" alt="">` : coverHTML(x.title, i, '', EMBLEM)}</span>`;
  const link = !team && safeUrl(x.link);
  const meta = team
    ? [x.role || 'Sin rol', `${x.socials.filter((s) => safeUrl(s.url)).length} redes`]
    : [x.badge, link ? `Enlace: ${domainOf(link)}` : 'Sin enlace', x.tags.slice(0, 3).join(', ')].filter(Boolean);
  const flags = [
    x.hidden ? '<span class="row__flag">Oculto</span>' : '',
    String(raw).startsWith('data:') ? '<span class="row__flag row__flag--new">Imagen nueva</span>' : '',
  ].join('');
  return `<li class="row${x.hidden ? ' is-hidden' : ''}" draggable="true" data-id="${escapeHtml(x.id)}" data-index="${i}">
    <span class="row__handle" title="Arrastra para ordenar">${icon('drag')}</span>
    ${thumb}
    <div class="row__main">
      <strong class="row__title">${escapeHtml(nameOf(key, x))}</strong>
      <span class="row__meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}${flags}</span>
    </div>
    <div class="row__actions">
      <button class="btn btn--sm btn--icon btn--ghost" type="button" data-action="up" title="Subir" aria-label="Subir"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>
      <button class="btn btn--sm btn--icon btn--ghost" type="button" data-action="down" title="Bajar" aria-label="Bajar"${i === n - 1 ? ' disabled' : ''}>${icon('down')}</button>
      <button class="btn btn--sm btn--icon btn--ghost" type="button" data-action="toggle" title="${x.hidden ? 'Mostrar en la web' : 'Ocultar de la web'}" aria-label="${x.hidden ? 'Mostrar en la web' : 'Ocultar de la web'}">${icon(x.hidden ? 'eyeOff' : 'eye')}</button>
      <button class="btn btn--sm btn--icon btn--ghost" type="button" data-action="dup" title="Duplicar" aria-label="Duplicar">${icon('copy')}</button>
      <button class="btn btn--sm" type="button" data-action="edit">${icon('edit')}<span>Editar</span></button>
      <button class="btn btn--sm btn--icon btn--danger" type="button" data-action="delete" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
    </div>
  </li>`;
}

function move(key, from, to) {
  const list = listOf(key);
  if (to < 0 || to >= list.length || from === to) return;
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
  refresh();
}

// ---------------------------------------------------------------- eventos del panel

function bindApp() {
  const ws = $('#workspace');

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === S.tab) return;
    S.tab = b.dataset.tab;
    renderTabs();
    renderTab();
    ws.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  });

  ws.addEventListener('input', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    const kind = el.dataset.kind;
    let v = el.value;
    if (kind === 'lines') v = v.split('\n').map((s) => s.trim()).filter(Boolean);
    setPath(S.draft, el.dataset.path, v);
    if (kind === 'url') el.classList.toggle('is-invalid', Boolean(v.trim()) && !safeUrl(v));
    if (kind === 'email') el.classList.toggle('is-invalid', Boolean(v.trim()) && !EMAIL_RE.test(v.trim()));
    changed();
  });

  ws.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-import]');
    if (!input?.files?.[0]) return;
    try {
      const data = JSON.parse(await input.files[0].text());
      const ok = await confirmDialog(modal, { title: '¿Importar este archivo?', text: 'Su contenido reemplazará tu borrador actual. No se publica hasta que pulses “Publicar”.', ok: 'Importar' });
      if (ok) { S.draft = normalizeContent(data); refresh(); toast('Archivo importado al borrador', { type: 'success' }); }
    } catch {
      toast('El archivo no es un JSON válido.', { type: 'error' });
    }
    input.value = '';
  });

  ws.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const action = b.dataset.action;
    if (action === 'history-refresh') { loadHistory(); return; }
    if (action === 'restore') { restoreVersion(b.dataset.sha); return; }
    if (action === 'export') { exportJSON(); return; }

    const key = b.dataset.list || b.closest('[data-rows]')?.dataset.rows;
    if (!key) return;
    if (action === 'add') { openEditor(key, null); return; }

    const row = b.closest('.row');
    const list = listOf(key);
    const idx = list.findIndex((x) => x.id === row?.dataset.id);
    if (idx < 0) return;
    const item = list[idx];

    if (action === 'edit') openEditor(key, item.id);
    else if (action === 'up') move(key, idx, idx - 1);
    else if (action === 'down') move(key, idx, idx + 1);
    else if (action === 'toggle') { item.hidden = !item.hidden; refresh(); }
    else if (action === 'dup') {
      const copy = deepClone(item);
      if (key === 'team') copy.name = `${copy.name} (copia)`;
      else copy.title = `${copy.title} (copia)`;
      copy.id = uniqueId(key, nameOf(key, copy));
      list.splice(idx + 1, 0, copy);
      refresh();
      toast('Duplicado en el borrador', { type: 'success' });
    } else if (action === 'delete') {
      const ok = await confirmDialog(modal, {
        title: `¿Eliminar “${nameOf(key, item)}”?`,
        text: 'Se quitará del borrador. Si te equivocas, puedes descartar los cambios antes de publicar.',
        ok: 'Eliminar',
        danger: true,
      });
      if (ok) { list.splice(list.indexOf(item), 1); refresh(); }
    }
  });

  // Arrastrar y soltar para ordenar (escritorio)
  let drag = null;
  ws.addEventListener('dragstart', (e) => {
    const row = e.target.closest?.('.row');
    if (!row) return;
    drag = { key: row.closest('[data-rows]').dataset.rows, index: Number(row.dataset.index) };
    row.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id);
  });
  ws.addEventListener('dragover', (e) => {
    const row = e.target.closest?.('.row');
    if (!row || !drag) return;
    e.preventDefault();
    $$('.row.is-over').forEach((r) => r !== row && r.classList.remove('is-over'));
    row.classList.add('is-over');
  });
  ws.addEventListener('drop', (e) => {
    const row = e.target.closest?.('.row');
    if (!row || !drag) return;
    e.preventDefault();
    const key = row.closest('[data-rows]').dataset.rows;
    const { key: fromKey, index: from } = drag;
    drag = null;
    if (key === fromKey) move(key, from, Number(row.dataset.index));
  });
  ws.addEventListener('dragend', () => {
    drag = null;
    $$('.row.is-dragging, .row.is-over').forEach((r) => r.classList.remove('is-dragging', 'is-over'));
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-top="discard"]')) discard();
  });
  $('#btn-preview').addEventListener('click', openPreview);
  $('#btn-publish').addEventListener('click', publish);
  $('#btn-logout').addEventListener('click', logout);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!modal.isOpen && isDirty()) publish();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (S.publishing) { e.preventDefault(); e.returnValue = ''; }
  });
}

async function discard() {
  const ok = await confirmDialog(modal, {
    title: '¿Descartar los cambios?',
    text: 'Se perderán todos los cambios que no has publicado y el borrador volverá a ser igual que la web.',
    ok: 'Descartar',
    danger: true,
  });
  if (!ok) return;
  S.draft = deepClone(S.published);
  await idb.del(DRAFT_KEY);
  refresh();
  toast('Cambios descartados');
}

function openPreview() {
  const url = new URL('../?preview', location.href).href;
  window.open(url, '_blank', 'noopener');
  setTimeout(broadcast, 900);
  toast('Vista previa abierta en otra pestaña. Se actualiza sola mientras editas.');
}

async function logout() {
  if (isDirty()) {
    const ok = await confirmDialog(modal, {
      title: '¿Cerrar sesión?',
      text: 'Tu borrador se queda guardado en este navegador para la próxima vez.',
      ok: 'Cerrar sesión',
    });
    if (!ok) return;
  }
  clearToken();
  location.reload();
}

// ---------------------------------------------------------------- editor de miembros y tarjetas

function openEditor(key, id) {
  const team = key === 'team';
  const existing = id ? listOf(key).find((x) => x.id === id) : null;
  const data = existing
    ? deepClone(existing)
    : team
      ? { id: '', name: '', role: '', description: '', avatar: '', hidden: false, socials: [] }
      : { id: '', title: '', badge: '', tags: [], description: '', image: '', link: '', linkLabel: '', hidden: false };
  const ed = { key, id, team, data };
  modal.open(editorHTML(ed), { size: 'xl' });
  bindEditor(ed);
}

const eText = (name, label, value, { placeholder = '', hint = '', type = 'text', maxlength = 200, required = false } = {}) => `
  <label class="field">
    <span class="field__label">${escapeHtml(label)}${required ? ' <em>*</em>' : ''}</span>
    <input class="input" type="${type}" name="${name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" maxlength="${maxlength}"${required ? ' required' : ''}${type === 'url' ? ' inputmode="url" spellcheck="false"' : ''}>
    ${hint ? `<span class="field__hint">${hint}</span>` : ''}
  </label>`;

const eArea = (name, label, value, { rows = 5, hint = '', maxlength = 2000 } = {}) => `
  <label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <textarea class="input textarea" name="${name}" rows="${rows}" maxlength="${maxlength}">${escapeHtml(value)}</textarea>
    ${hint ? `<span class="field__hint">${hint}</span>` : ''}
  </label>`;

function socialRowHTML(s = { type: 'youtube', url: '' }) {
  return `<div class="social-row">
    <select class="input select" aria-label="Red social">${Object.entries(SOCIAL_TYPES).map(([k, v]) => `<option value="${k}"${k === s.type ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
    <input class="input" type="url" inputmode="url" spellcheck="false" placeholder="https://…" value="${escapeHtml(s.url)}" aria-label="Enlace de la red">
    <button class="btn btn--sm btn--icon btn--danger" type="button" data-ed="del-social" aria-label="Quitar esta red">${icon('trash')}</button>
  </div>`;
}

function previewHTML(ed) {
  const v = ed.team ? ed.data.avatar : ed.data.image;
  const src = imgSrc(v);
  if (ed.team) {
    return `<span class="avatar imgfield__avatar">${src ? `<img src="${escapeHtml(src)}" alt="">` : `<span class="avatar__initials">${escapeHtml(initials(ed.data.name || '?'))}</span>`}</span>`;
  }
  return `<span class="imgfield__cover">${src ? `<img src="${escapeHtml(src)}" alt="">` : coverHTML(ed.data.title || 'Nuevo', 0, '', EMBLEM)}</span>`;
}

function editorHTML(ed) {
  const d = ed.data;
  const meta = SECTION_META[ed.key];
  const heading = ed.id
    ? `Editar: ${ed.team ? d.name : d.title}`
    : ed.team ? 'Nuevo miembro' : `Nuevo ${meta.label.toLowerCase()}`;
  const v = ed.team ? d.avatar : d.image;
  const fields = ed.team ? `
      ${eText('name', 'Nombre', d.name, { required: true, maxlength: 60 })}
      ${eText('role', 'Rol', d.role, { placeholder: 'Ej: Builder, Beta Tester…', maxlength: 60 })}
      ${eArea('description', 'Descripción', d.description, { rows: 5, maxlength: 800, hint: 'Usa **texto** para negrita.' })}
      <div class="field">
        <span class="field__label">Redes sociales</span>
        <div class="socials-editor" id="socials-editor">${d.socials.map(socialRowHTML).join('')}</div>
        <div><button class="btn btn--sm btn--ghost" type="button" data-ed="add-social">${icon('plus')} Añadir red</button></div>
        <span class="field__hint">Aparecen en el cuadrito que sale al hacer clic en el miembro.</span>
      </div>` : `
      <label class="field">
        <span class="field__label">Sección</span>
        <select class="input select" name="section">${SECTION_KEYS.map((k) => `<option value="${k}"${k === ed.key ? ' selected' : ''}>${SECTION_META[k].plural}</option>`).join('')}</select>
      </label>
      ${eText('title', 'Título', d.title, { required: true, maxlength: 80 })}
      ${eArea('description', 'Descripción', d.description, { rows: 7, hint: 'En la tarjeta se ven las primeras líneas; al hacer clic se lee completa. Usa **texto** para negrita y una línea en blanco para separar párrafos.' })}
      <div class="grid-2">
        ${eText('badge', 'Etiqueta destacada', d.badge, { placeholder: 'Ej: En desarrollo, Gratis', maxlength: 30 })}
        ${eText('tags', 'Etiquetas', d.tags.join(', '), { placeholder: '1.21.11, Hardcore, Bosses', hint: 'Separadas por comas.', maxlength: 200 })}
      </div>
      ${eText('link', 'Enlace (opcional)', d.link, { type: 'url', placeholder: 'https://…', maxlength: 500, hint: 'Déjalo vacío si es privado. Si lo pones, al hacer clic la web muestra a dónde lleva y pregunta si quieres ir.' })}
      ${eText('linkLabel', 'Texto del botón del enlace', d.linkLabel, { placeholder: 'Ej: Descargar, Ver en GitHub', maxlength: 40 })}`;

  return `<form class="editor" id="editor" novalidate>
    <header class="editor__head">
      <p class="kicker">${icon(ed.team ? 'users' : meta.icon)} ${ed.team ? 'Equipo' : meta.plural}</p>
      <h2 class="editor__title" id="modal-title">${escapeHtml(heading)}</h2>
    </header>
    <div class="editor__body">
      <div class="imgfield${ed.team ? ' imgfield--round' : ''}">
        <div class="imgfield__preview" id="img-preview">${previewHTML(ed)}</div>
        <div class="imgfield__actions">
          <label class="btn btn--sm">${icon('upload')} Subir ${ed.team ? 'foto' : 'imagen'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" data-ed="file" hidden></label>
          <button class="btn btn--sm btn--ghost" type="button" data-ed="url-toggle">${icon('link')} URL</button>
          <button class="btn btn--sm btn--ghost" type="button" data-ed="clear" id="img-clear"${v ? '' : ' disabled'}>${icon('trash')} Quitar</button>
        </div>
        <div class="imgfield__url" id="img-url" hidden>
          <input class="input" type="url" inputmode="url" spellcheck="false" placeholder="https://…/imagen.png" data-ed="url-input" value="${/^https:/i.test(v) ? escapeHtml(v) : ''}">
          <button class="btn btn--sm" type="button" data-ed="url-apply">Aplicar</button>
        </div>
        <p class="field__hint" id="img-info">${ed.team ? 'Se recorta en cuadrado (512×512).' : 'Recomendado 1280×800 (16:10).'} JPG, PNG, WebP o GIF; se optimiza sola. ${v ? '' : ed.team ? 'Sin foto se muestran sus iniciales.' : 'Sin imagen se usa la portada por defecto.'}</p>
      </div>
      <div class="editor__fields">
        ${fields}
        <label class="check"><input type="checkbox" name="visible"${d.hidden ? '' : ' checked'}><span>Visible en la web</span></label>
      </div>
    </div>
    <p class="form-error" id="editor-error" role="alert" hidden></p>
    <footer class="modal__actions editor__actions">
      <button class="btn btn--ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn--primary" type="submit">${icon('check')} Guardar</button>
    </footer>
  </form>`;
}

function bindEditor(ed) {
  const form = $('#editor');
  const info = (msg) => { $('#img-info').textContent = msg; };
  const fail = (msg) => { const el = $('#editor-error'); el.textContent = msg; el.hidden = false; };
  const setImg = (value) => {
    if (ed.team) ed.data.avatar = value;
    else ed.data.image = value;
    $('#img-preview').innerHTML = previewHTML(ed);
    $('#img-clear').disabled = !value;
  };

  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    const act = b.dataset.ed;
    if (act === 'url-toggle') {
      $('#img-url').hidden = !$('#img-url').hidden;
      if (!$('#img-url').hidden) form.querySelector('[data-ed="url-input"]').focus();
    } else if (act === 'url-apply') {
      const url = form.querySelector('[data-ed="url-input"]').value.trim();
      const safe = safeImage(url);
      if (!safe || !/^https:/i.test(safe)) { fail('La URL de la imagen debe empezar por https://'); return; }
      setImg(safe);
      info('Imagen externa aplicada.');
    } else if (act === 'clear') {
      setImg('');
      info(ed.team ? 'Sin foto: se mostrarán sus iniciales.' : 'Sin imagen: se usará la portada por defecto.');
    } else if (act === 'add-social') {
      $('#socials-editor').insertAdjacentHTML('beforeend', socialRowHTML());
      $('#socials-editor').lastElementChild.querySelector('input').focus();
    } else if (act === 'del-social') {
      b.closest('.social-row').remove();
    }
  });

  form.querySelector('[data-ed="file"]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    info('Optimizando imagen…');
    try {
      const res = await processImage(file, ed.team ? { maxW: 512, maxH: 512, square: true } : { maxW: 1280, maxH: 1280 });
      setImg(res.dataUrl);
      info(`Lista: ${res.width}×${res.height} px · ${fmtKB(res.bytes)}. Se subirá a GitHub al publicar.`);
    } catch (err) {
      info('');
      fail(err.message);
    }
  });

  form.addEventListener('input', (e) => {
    if (e.target.name === 'name' || e.target.name === 'title') {
      ed.data[e.target.name] = e.target.value;
      if (!(ed.team ? ed.data.avatar : ed.data.image)) $('#img-preview').innerHTML = previewHTML(ed);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEditor(ed, form, fail);
  });
}

function saveEditor(ed, form, fail) {
  const f = new FormData(form);
  const d = ed.data;
  const val = (k) => String(f.get(k) ?? '').trim();
  let targetKey = ed.key;

  if (ed.team) {
    d.name = val('name');
    d.role = val('role');
    d.description = String(f.get('description') ?? '').trim();
    if (!d.name) return fail('El nombre es obligatorio.');
    const socials = $$('.social-row', form)
      .map((r) => ({ type: r.querySelector('select').value, url: r.querySelector('input').value.trim() }))
      .filter((s) => s.url);
    const bad = socials.find((s) => !safeUrl(s.url));
    if (bad) return fail(`El enlace de ${SOCIAL_TYPES[bad.type]?.label || 'la red'} no es válido.`);
    d.socials = socials.map((s) => ({ type: s.type, url: safeUrl(s.url) }));
  } else {
    targetKey = SECTION_KEYS.includes(val('section')) ? val('section') : ed.key;
    d.title = val('title');
    d.description = String(f.get('description') ?? '').trim();
    d.badge = val('badge');
    d.tags = val('tags').split(',').map((s) => s.trim()).filter(Boolean);
    d.link = val('link');
    d.linkLabel = val('linkLabel');
    if (!d.title) return fail('El título es obligatorio.');
    if (d.link && !safeUrl(d.link)) return fail('El enlace no es válido. Debe ser una dirección web (https://…).');
    d.link = d.link ? safeUrl(d.link) : '';
  }
  d.hidden = !f.get('visible');

  const source = listOf(ed.key);
  const target = listOf(targetKey);
  if (!d.id || target.some((x) => x.id === d.id && x.id !== ed.id)) d.id = uniqueId(targetKey, nameOf(targetKey, d));

  if (ed.id) {
    const idx = source.findIndex((x) => x.id === ed.id);
    if (targetKey === ed.key) source[idx] = d;
    else { source.splice(idx, 1); target.push(d); }
  } else {
    target.push(d);
  }
  modal.close();
  refresh();
  const moved = targetKey !== ed.key ? ` (movido a ${SECTION_META[targetKey].plural})` : '';
  toast(ed.id ? `Guardado en el borrador${moved}` : `Añadido al borrador${moved}`, { type: 'success' });
  return undefined;
}

// Redimensiona y comprime las imágenes antes de subirlas.
async function processImage(file, { maxW, maxH, square = false, quality = 0.86 }) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen pesa más de 20 MB.');
  if (file.type === 'image/gif') {
    if (file.size > 3 * 1024 * 1024) throw new Error('Los GIF animados deben pesar menos de 3 MB.');
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error('No se pudo leer el GIF.'));
      r.readAsDataURL(file);
    });
    const img = await loadImage(file);
    return { dataUrl, bytes: file.size, width: img.naturalWidth, height: img.naturalHeight };
  }
  const img = await loadImage(file);
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = side;
    sh = side;
  }
  const scale = Math.min(1, maxW / sw, maxH / sh);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
  const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
  return { dataUrl, bytes, width: w, height: h };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen. Prueba con JPG o PNG.')); };
    img.src = url;
  });
}

// ---------------------------------------------------------------- publicar

function validate(c) {
  const problems = [];
  if (!c.site.name.trim()) problems.push('El nombre del estudio está vacío (General).');
  for (const [k, label] of [['youtube', 'YouTube'], ['x', 'X'], ['discord', 'Discord']]) {
    if (c.socials[k] && !safeUrl(c.socials[k])) problems.push(`El enlace de ${label} del estudio no es válido (General).`);
  }
  if (c.contact.email && !EMAIL_RE.test(c.contact.email)) problems.push('El correo de contacto no es válido (Contacto).');
  c.team.members.forEach((m, i) => { if (!m.name.trim()) problems.push(`El miembro #${i + 1} no tiene nombre (Equipo).`); });
  for (const k of SECTION_KEYS) {
    c.sections[k].items.forEach((it, i) => {
      if (!it.title.trim()) problems.push(`La tarjeta #${i + 1} de ${SECTION_META[k].plural} no tiene título.`);
      if (it.link && !safeUrl(it.link)) problems.push(`El enlace de “${it.title}” no es válido (${SECTION_META[k].plural}).`);
    });
  }
  return problems;
}

function commitTitle(changes) {
  const areas = [...new Set(changes.map((c) => c.area))];
  const text = `Panel: actualiza ${areas.join(', ')}`;
  return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

function publish() {
  if (S.publishing || modal.isOpen) return;
  const next = normalizeContent(S.draft);
  const changes = summarize(S.published, next);
  if (!changes.length) { toast('No hay cambios para publicar.'); return; }
  const problems = validate(next);
  if (problems.length) {
    modal.open(`<div class="confirm">
      <div class="confirm__icon is-danger">${icon('alert')}</div>
      <h2 class="confirm__title" id="modal-title">Revisa esto antes de publicar</h2>
      <ul class="problems">${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      <div class="modal__actions"><button class="btn btn--primary" type="button" data-close>Entendido</button></div>
    </div>`, { size: 'sm' });
    return;
  }
  const pending = collectImages(deepClone(next)).length;
  const c = modal.open(`<div class="publish">
    <h2 class="publish__title" id="modal-title">Publicar cambios</h2>
    <p class="publish__text">Se guardará una nueva versión en GitHub${pending ? ` junto con <b>${pending} ${pending === 1 ? 'imagen nueva' : 'imágenes nuevas'}</b>` : ''}. La web se actualiza para todo el mundo en 1-2 minutos.</p>
    <ul class="changes">${changes.map((ch) => `<li class="change change--${ch.kind}"><b>${escapeHtml(ch.area)}</b><span>${escapeHtml(ch.text)}</span></li>`).join('')}</ul>
    <label class="field">
      <span class="field__label">Descripción del cambio (queda en el historial)</span>
      <input class="input" id="commit-msg" maxlength="100" value="${escapeHtml(commitTitle(changes))}">
    </label>
    <div class="modal__actions">
      <button class="btn btn--ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn--primary" type="button" id="do-publish">${icon('upload')} Publicar ahora</button>
    </div>
  </div>`, { size: 'lg' });
  c.querySelector('#do-publish').addEventListener('click', () => {
    const msg = c.querySelector('#commit-msg').value.trim() || commitTitle(changes);
    runPublish(next, changes, msg);
  });
}

function collectImages(content) {
  const jobs = [];
  content.team.members.forEach((m) => {
    if (m.avatar.startsWith('data:')) jobs.push({ dataUrl: m.avatar, kind: 'miembro', name: m.name, set: (p) => { m.avatar = p; } });
  });
  for (const k of SECTION_KEYS) {
    content.sections[k].items.forEach((it) => {
      if (it.image.startsWith('data:')) jobs.push({ dataUrl: it.image, kind: SECTION_META[k].slug, name: it.title, set: (p) => { it.image = p; } });
    });
  }
  return jobs;
}

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/avif': 'avif' };

async function runPublish(next, changes, message, { force = false } = {}) {
  S.publishing = true;
  updateStatus();
  modal.setLocked(true);
  const c = modal.open(`<div class="publish">
    <h2 class="publish__title" id="modal-title">Publicando…</h2>
    <ol class="steps">
      <li class="step" data-step="1"><span class="step__dot"></span><div class="step__text"><strong>Preparando imágenes y contenido</strong><small></small></div></li>
      <li class="step" data-step="2"><span class="step__dot"></span><div class="step__text"><strong>Guardando la nueva versión en GitHub</strong><small></small></div></li>
      <li class="step" data-step="3"><span class="step__dot"></span><div class="step__text"><strong>Actualizando la web (GitHub Pages)</strong><small>Suele tardar entre 30 segundos y 2 minutos.</small></div></li>
    </ol>
    <div id="publish-result"></div>
  </div>`, { size: 'lg', lock: true });
  const ui = c.querySelector('.publish');
  const step = (n, state, text) => {
    const el = ui.querySelector(`[data-step="${n}"]`);
    if (!el) return;
    el.className = `step is-${state}`;
    if (text !== undefined) el.querySelector('small').textContent = text;
  };
  const setTitle = (text) => { ui.querySelector('.publish__title').textContent = text; };
  const result = (html, isError = false) => {
    ui.querySelector('#publish-result').innerHTML = `<div class="publish__result${isError ? ' is-error' : ''}">${html}</div>`;
  };

  let committed = false;
  try {
    step(1, 'active');
    const content = deepClone(next);
    const files = [];
    const byData = new Map();
    for (const job of collectImages(content)) {
      let path = byData.get(job.dataUrl);
      if (!path) {
        const mime = job.dataUrl.slice(5, job.dataUrl.indexOf(';'));
        const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        path = `${CONFIG.uploadsDir}/${job.kind}-${slugify(job.name)}-${stamp}.${EXT[mime] || 'img'}`;
        byData.set(job.dataUrl, path);
        files.push({ path, content: job.dataUrl.slice(job.dataUrl.indexOf(',') + 1), encoding: 'base64' });
      }
      job.set(path);
    }
    content.meta = {
      version: (S.published.meta.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: S.user.login,
    };
    files.push({ path: CONFIG.contentPath, content: `${JSON.stringify(content, null, 2)}\n`, encoding: 'utf-8' });
    step(1, 'done', `${byData.size ? `${byData.size} ${byData.size === 1 ? 'imagen' : 'imágenes'} + ` : ''}contenido listo`);

    step(2, 'active', 'Subiendo archivos…');
    const body = changes.map((ch) => `- ${ch.area}: ${ch.text}`).join('\n');
    const { commit, shas } = await S.gh.commitFiles({
      files,
      message: `${message}\n\n${body}`,
      expect: force ? null : { path: CONFIG.contentPath, sha: S.publishedSha },
      onProgress: (d, t) => step(2, 'active', `Subiendo archivos… ${d}/${t}`),
    });
    committed = true;
    step(2, 'done', `Versión ${commit.sha.slice(0, 7)} guardada`);

    const cache = (await idb.get(UPLOADS_KEY)) || {};
    for (const [dataUrl, path] of byData) {
      S.uploads.set(path, dataUrl);
      cache[path] = { d: dataUrl, t: Date.now() };
    }
    if (byData.size) idb.set(UPLOADS_KEY, cache);

    S.published = normalizeContent(content);
    S.publishedSha = shas[CONFIG.contentPath];
    S.draft = deepClone(S.published);
    await idb.del(DRAFT_KEY);
    S.publishing = false;
    renderTabs();
    renderTab();
    updateStatus();
    broadcast();
    modal.setLocked(false);

    step(3, 'active', 'Esperando a GitHub Pages… (puedes cerrar esta ventana y seguir editando)');
    const live = await waitForDeploy(content.meta.updatedAt, (secs) => step(3, 'active', `Esperando a GitHub Pages… ${secs} s (puedes cerrar esta ventana)`));
    if (!ui.isConnected) {
      toast(live ? '¡Tus cambios ya están en la web!' : 'Guardado en GitHub; la web se actualizará en unos minutos.', { type: 'success', timeout: 4000 });
      return;
    }
    if (live) {
      step(3, 'done', 'La web ya muestra los cambios');
      setTitle('¡Publicado!');
      result(`<p>${icon('check')} <span>Tus cambios ya están en la web para todo el mundo.</span></p>
        <div class="modal__actions"><button class="btn btn--ghost" type="button" data-close>Cerrar</button><a class="btn btn--primary" href="${escapeHtml(CONFIG.siteUrl)}" target="_blank" rel="noopener">${icon('external')} Ver la web</a></div>`);
    } else {
      step(3, 'done', 'GitHub sigue desplegando');
      setTitle('Guardado en GitHub');
      result(`<p>${icon('info')} <span>La versión está guardada. GitHub Pages está tardando más de lo normal; los cambios aparecerán en la web en unos minutos.</span></p>
        <div class="modal__actions"><button class="btn btn--primary" type="button" data-close>Cerrar</button></div>`);
    }
  } catch (err) {
    S.publishing = false;
    updateStatus();
    modal.setLocked(false);
    if (err.conflict && !committed) {
      modal.open(`<div class="confirm">
        <div class="confirm__icon is-danger">${icon('alert')}</div>
        <h2 class="confirm__title" id="modal-title">La web cambió mientras editabas</h2>
        <p class="confirm__text">Se publicó otra versión (quizá desde otro dispositivo) después de abrir el panel. Puedes cargar esa versión (perderás tu borrador) o sobrescribirla con tus cambios.</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" type="button" data-close>Cancelar</button>
          <button class="btn" type="button" id="c-reload">${icon('refresh')} Cargar la versión nueva</button>
          <button class="btn btn--danger" type="button" id="c-force">${icon('upload')} Sobrescribir</button>
        </div>
      </div>`, { size: 'sm' });
      $('#c-reload').addEventListener('click', async () => {
        modal.close();
        try { await loadRemote(); S.pendingDraft = null; await idb.del(DRAFT_KEY); refresh(); toast('Versión más reciente cargada', { type: 'success' }); }
        catch (e2) { toast(explainError(e2), { type: 'error' }); }
      });
      $('#c-force').addEventListener('click', () => runPublish(next, changes, message, { force: true }));
      return;
    }
    if (!ui.isConnected) { toast(explainError(err), { type: 'error', timeout: 6000 }); return; }
    const failed = ui.querySelector('.step.is-active');
    if (failed) failed.className = 'step is-error';
    setTitle('No se pudo publicar');
    result(`<p>${icon('alert')} <span>${escapeHtml(explainError(err))}</span></p>
      <p class="muted">Tu borrador sigue guardado; no se ha perdido nada.</p>
      <div class="modal__actions"><button class="btn btn--primary" type="button" data-close>Cerrar</button></div>`, true);
  }
}

async function waitForDeploy(stamp, onTick) {
  const url = new URL(CONFIG.contentPath, CONFIG.siteUrl).href;
  const t0 = Date.now();
  while (Date.now() - t0 < 4 * 60 * 1000) {
    await sleep(6000);
    onTick?.(Math.round((Date.now() - t0) / 1000));
    try {
      const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.meta?.updatedAt === stamp) return true;
      }
    } catch { /* la web aún no responde */ }
  }
  return false;
}

// ---------------------------------------------------------------- historial

async function loadHistory() {
  const box = $('#history-list');
  if (!box) return;
  box.innerHTML = '<p class="muted">Cargando…</p>';
  try {
    const commits = await S.gh.history(CONFIG.contentPath, 15);
    if (!$('#history-list')) return;
    box.innerHTML = commits.length
      ? `<ul class="history">${commits.map((cm, i) => `
        <li class="history__item">
          ${cm.author?.avatar_url ? `<img class="history__avatar" src="${escapeHtml(cm.author.avatar_url)}" alt="">` : ''}
          <div class="history__main">
            <strong>${escapeHtml(cm.commit.message.split('\n')[0])}</strong>
            <span>${escapeHtml(cm.author?.login || cm.commit.author?.name || '')} · ${escapeHtml(fmtDate(cm.commit.author?.date))}${i === 0 ? ' · <b>versión actual</b>' : ''}</span>
          </div>
          ${i === 0 ? '' : `<button class="btn btn--sm btn--ghost" type="button" data-action="restore" data-sha="${escapeHtml(cm.sha)}">${icon('refresh')}<span>Cargar</span></button>`}
        </li>`).join('')}</ul>`
      : '<p class="muted">Aún no hay versiones publicadas.</p>';
  } catch (err) {
    box.innerHTML = `<p class="form-error">${escapeHtml(explainError(err))}</p>`;
  }
}

async function restoreVersion(sha) {
  if (!/^[0-9a-f]{7,40}$/i.test(sha || '')) return;
  const ok = await confirmDialog(modal, {
    title: '¿Cargar esta versión?',
    text: 'Se cargará en el borrador para que la revises. No cambia la web hasta que pulses “Publicar”.',
    ok: 'Cargar versión',
  });
  if (!ok) return;
  try {
    const { text } = await S.gh.getText(CONFIG.contentPath, sha);
    S.draft = normalizeContent(JSON.parse(text));
    refresh();
    toast('Versión cargada en el borrador. Revísala y pulsa Publicar.', { type: 'success' });
  } catch (err) {
    toast(explainError(err), { type: 'error' });
  }
}

function exportJSON() {
  const blob = new Blob([`${JSON.stringify(normalizeContent(S.draft), null, 2)}\n`], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `viciont-contenido-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

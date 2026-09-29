import { CONFIG } from './config.js';
import {
  normalizeContent, SECTION_KEYS, SECTION_META, SOCIAL_TYPES, escapeHtml, richText, inlineRich,
  safeUrl, safeImage, domainOf, handleFromUrl, icon, hydrateIcons, initials, coverHTML, pad2, visible,
} from './core.js';
import { startBackground } from './background.js';
import * as fx from './fx.js';
import { createModal, toast, copyText } from './ui.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

document.documentElement.classList.add('js');
hydrateIcons();

const ROUTES = {
  'sobre-nosotros': { view: 'about' },
  inicio: { view: 'about' },
  equipo: { view: 'about', anchor: 'team' },
  proyectos: { view: 'projects' },
  plugins: { view: 'plugins' },
  mods: { view: 'mods' },
  launcher: { view: 'launcher' },
  descargar: { view: 'launcher' },
  contacto: { view: 'contact' },
};
const VIEW_ORDER = ['about', 'projects', 'plugins', 'mods', 'launcher', 'contact'];
const VIEW_ROUTE = { about: 'sobre-nosotros', projects: 'proyectos', plugins: 'plugins', mods: 'mods', launcher: 'launcher', contact: 'contacto' };
const BASE_TITLE = document.title;
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const state = {
  content: null,
  view: '',
  stamp: '',
  preview: new URLSearchParams(location.search).has('preview'),
};

const modal = createModal();
const boot = fx.bootScreen();
startBackground($('#bg'));
fx.startGlitchBursts();
fx.bindTilt(document);
fx.cursorGlow();
bindChrome();
$('#year').textContent = String(new Date().getFullYear());

if (state.preview) startPreview();
else load({ live: true });

async function fetchContent() {
  const res = await fetch(`${CONFIG.contentPath}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function load({ live }) {
  try {
    render(await fetchContent());
    if (live) startLiveUpdates();
  } catch (err) {
    console.error('[viciont] no se pudo cargar el contenido', err);
    showLoadError();
  } finally {
    boot.done();
  }
}

function startLiveUpdates() {
  let last = Date.now();
  const check = async () => {
    last = Date.now();
    try {
      const raw = await fetchContent();
      const stamp = raw?.meta?.updatedAt || '';
      if (stamp && stamp !== state.stamp) {
        render(raw, { live: true });
        toast('Contenido actualizado', { type: 'success' });
      }
    } catch {}
  };
  setInterval(() => { if (!document.hidden) check(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - last > 20000) check();
  });
}

function startPreview() {
  $('#preview-bar').hidden = false;
  document.documentElement.classList.add('is-preview');
  let got = false;
  try {
    const bc = new BroadcastChannel(`vs-preview:${CONFIG.owner}/${CONFIG.repo}`);
    bc.onmessage = (e) => {
      const d = e.data;
      if (!d || d.type !== 'content' || !d.content) return;
      const first = !got;
      got = true;
      render(d.content, { live: !first || Boolean(state.view) });
      if (first) boot.done();
    };
    bc.postMessage({ type: 'hello' });
  } catch {}
  setTimeout(() => {
    if (got) return;
    $('#preview-text').textContent = 'Vista previa: abre el panel de administración en otra pestaña para ver tus cambios en vivo.';
    load({ live: false });
  }, 1500);
}

function labels(c) {
  return {
    about: c.about.title,
    projects: c.sections.projects.title,
    plugins: c.sections.plugins.title,
    mods: c.sections.mods.title,
    launcher: 'Launcher',
    contact: c.contact.title,
  };
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function render(raw, { live = false } = {}) {
  const c = normalizeContent(raw);
  state.content = c;
  state.stamp = c.meta.updatedAt;

  $$('[data-bind]').forEach((el) => {
    const v = getPath(c, el.dataset.bind);
    const text = typeof v === 'string' ? v : '';
    el.textContent = text;
    el.dataset.final = text;
    if (el.hasAttribute('data-text')) el.dataset.text = text;
    if (el.tagName === 'P') el.hidden = !text;
  });

  const parts = c.site.name.trim().split(/\s+/);
  const first = parts[0] || c.site.name;
  const rest = parts.slice(1).join(' ');
  $$('[data-brand-first], [data-hero-first]').forEach((el) => { el.textContent = first; el.dataset.text = first; });
  $$('[data-brand-rest], [data-hero-rest]').forEach((el) => { el.textContent = rest; el.dataset.text = rest; });
  $('.hero__line--2').hidden = !rest;

  const L = labels(c);
  $$('[data-label]').forEach((el) => { el.textContent = L[el.dataset.label] ?? el.textContent; });

  for (const type of ['youtube', 'x', 'discord']) {
    const url = safeUrl(c.socials[type]);
    $$(`[data-social="${type}"]`).forEach((a) => {
      a.href = url || '#';
      a.classList.toggle('is-empty', !url);
      if (url) a.removeAttribute('aria-disabled');
      else a.setAttribute('aria-disabled', 'true');
    });
  }

  renderHome(c, live);
  SECTION_KEYS.forEach((k) => renderSection(c, k));
  renderPager(c, 'launcher');
  renderContact(c);

  const credit = $('#footer-credit');
  credit.textContent = c.footer.credit;
  credit.dataset.text = c.footer.credit;

  fx.observeReveals(document, { instant: live });
  if (!state.view) route({ initial: true });
  else updateTitle();
}

function renderHome(c, live) {
  $('#about-text').innerHTML = richText(c.about.text);

  const words = c.site.ticker.length ? c.site.ticker : [c.site.name];
  const seq = words.map((w) => `<span class="ticker__item">${escapeHtml(w)}</span>`).join('');
  $('#ticker').innerHTML = `<div class="ticker__group">${seq}</div><div class="ticker__group">${seq}</div>`;
  $('#ticker').style.setProperty('--dur', `${Math.max(18, words.join(' ').length * 0.45)}s`);

  const typing = $('[data-typing]');
  const typingKey = c.site.typing.join('|');
  if (typing.dataset.words !== typingKey) {
    typing.dataset.words = typingKey;
    fx.typeLoop(typing, c.site.typing);
  }

  const counts = {
    projects: visible(c.sections.projects.items).length,
    plugins: visible(c.sections.plugins.items).length,
    mods: visible(c.sections.mods.items).length,
    team: visible(c.team.members).length,
  };
  $$('[data-count]').forEach((el) => { el.textContent = pad2(counts[el.dataset.count] ?? 0); });
  const stats = $('.stats');
  $$('[data-stat]').forEach((el) => {
    const n = counts[el.dataset.stat] ?? 0;
    el.dataset.value = String(n);
    if (live || stats.classList.contains('in')) el.textContent = pad2(n);
  });
  if (!stats.dataset.bound) {
    stats.dataset.bound = '1';
    stats.addEventListener('reveal', () => $$('[data-stat]').forEach((el) => fx.countUp(el, Number(el.dataset.value) || 0)));
  }

  const services = c.contact.services.length ? c.contact.services : ['Servidores', 'Eventos', 'Plugins', 'Mods'];
  $('#about-services').innerHTML = chipsHTML([...new Set([...c.site.ticker.slice(0, 6), ...services])].slice(0, 8));

  renderTeam(c);
}

const chipsHTML = (arr) => arr.map((t) => `<li class="chip">${escapeHtml(t)}</li>`).join('');
const tagsHTML = (tags) => (tags.length ? `<ul class="tags">${tags.map((t) => `<li class="tag">${escapeHtml(t)}</li>`).join('')}</ul>` : '');

function emptyHTML(text, retry = false) {
  return `<div class="empty">${icon(retry ? 'alert' : 'sparkle')}<p>${escapeHtml(text)}</p>${retry ? '<button class="btn btn--sm" type="button" data-retry>Reintentar</button>' : ''}</div>`;
}

function avatarHTML(m) {
  const src = safeImage(m.avatar);
  return src
    ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`
    : `<span class="avatar__initials">${escapeHtml(initials(m.name))}</span>`;
}

function renderTeam(c) {
  const members = visible(c.team.members);
  $('#team-grid').innerHTML = members.length
    ? members.map((m, i) => `
      <article class="member reveal" style="--i:${i % 4}" data-tilt>
        <div class="member__banner member__banner--${i % 3}"><span class="member__code">#${pad2(i + 1)}</span></div>
        <div class="avatar member__avatar">${avatarHTML(m)}</div>
        <div class="member__body">
          <h3 class="member__name">${escapeHtml(m.name)}${icon('verified', 'member__verified')}</h3>
          ${m.role ? `<span class="role">${escapeHtml(m.role)}</span>` : ''}
          ${m.description ? `<div class="member__desc rich">${richText(m.description)}</div>` : ''}
          <span class="member__cta">${icon('link')} Ver redes</span>
        </div>
        <button class="hit" type="button" data-member="${escapeHtml(m.id)}" aria-haspopup="dialog" aria-label="Ver redes de ${escapeHtml(m.name)}"></button>
      </article>`).join('')
    : emptyHTML('Muy pronto conocerás al equipo.');
}

function cardHTML(it, key, i) {
  const meta = SECTION_META[key];
  const img = safeImage(it.image);
  const link = safeUrl(it.link);
  const media = img
    ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(it.title)}" loading="lazy" decoding="async">`
    : coverHTML(it.title, i, `VS-${meta.code}-${pad2(i + 1)}`);
  return `
    <article class="card reveal" style="--i:${i % 6}" data-tilt>
      <div class="card__media">
        ${media}
        ${it.badge ? `<span class="card__badge">${escapeHtml(it.badge)}</span>` : ''}
        <span class="card__type">${icon(meta.icon)}${escapeHtml(meta.label)}</span>
      </div>
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(it.title)}</h3>
        <p class="card__desc">${inlineRich(it.description)}</p>
        ${tagsHTML(it.tags)}
        <div class="card__foot">
          ${link
            ? `<span class="card__status card__status--link">${icon('link')}${escapeHtml(domainOf(link))}</span>`
            : `<span class="card__status">${icon('lock')}Sin enlace</span>`}
          <span class="card__more">${escapeHtml(link ? it.linkLabel || 'Abrir' : 'Ver más')}${icon('arrowRight')}</span>
        </div>
      </div>
      <button class="hit" type="button" data-open-item="${key}:${escapeHtml(it.id)}" aria-haspopup="dialog"
        aria-label="${escapeHtml(`${link ? 'Abrir enlace de' : 'Ver detalles de'} ${it.title}`)}"></button>
      <span class="card__glare" aria-hidden="true"></span>
    </article>`;
}

function renderSection(c, key) {
  const sec = c.sections[key];
  const meta = SECTION_META[key];
  const items = visible(sec.items);
  $(`[data-cards="${key}"]`).innerHTML = items.length
    ? items.map((it, i) => cardHTML(it, key, i)).join('')
    : emptyHTML(`Muy pronto habrá ${meta.plural.toLowerCase()} por aquí.`);
  $(`[data-count-label="${key}"]`).textContent = `${pad2(items.length)} ${items.length === 1 ? meta.label : meta.plural}`.toUpperCase();
  renderPager(c, key);
}

function renderPager(c, view) {
  const box = $(`[data-pager="${view}"]`);
  if (!box) return;
  const L = labels(c);
  const idx = VIEW_ORDER.indexOf(view);
  const prev = VIEW_ORDER[idx - 1];
  const next = VIEW_ORDER[idx + 1];
  const link = (v, dir) => `
    <a class="pager__link pager__link--${dir}" href="#${VIEW_ROUTE[v]}" data-route="${VIEW_ROUTE[v]}">
      <small>${dir === 'prev' ? `${icon('arrowLeft')} Anterior` : `Siguiente ${icon('arrowRight')}`}</small>
      <strong>${escapeHtml(L[v])}</strong>
    </a>`;
  box.innerHTML = `${prev ? link(prev, 'prev') : '<span></span>'}${next ? link(next, 'next') : '<span></span>'}`;
}

const LAUNCHER_REPO = 'CrissyjuanxD/Viciont-Studio-Launcher';
const DL_BASE = `https://github.com/${LAUNCHER_REPO}/releases/latest/download`;
const PLATFORMS = {
  win: {
    name: 'Windows', icon: 'windows', file: 'Viciont-Studios-Launcher-Setup.exe', asset: /Launcher-Setup-\d[\w.-]*\.exe$/i,
    sub: 'Instalador gratuito · siempre la última versión',
    fact: 'Se actualiza solo: cuando sale una versión nueva, el launcher la instala sin que hagas nada.',
    toast: 'Descargando el instalador de Viciont Studios Launcher…',
  },
  mac: {
    name: 'Mac', icon: 'apple', file: 'Viciont-Studios-Launcher-mac.dmg', asset: /Launcher-\d[\w.-]*-mac\.dmg$/i,
    sub: 'Para Mac con chip Apple o Intel · macOS 13 o superior',
    fact: 'Te avisa cuando sale una versión nueva: la descargas desde aquí y la arrastras a Aplicaciones.',
    toast: 'Descargando Viciont Studios Launcher para Mac…',
  },
  linux: {
    name: 'Linux', icon: 'linux', file: 'Viciont-Studios-Launcher-linux.AppImage', asset: /^Viciont-Studios-Launcher-linux\.AppImage$/i,
    sub: 'AppImage para cualquier distribución · también en .deb y .rpm',
    fact: 'Con la AppImage se actualiza solo; con .deb o .rpm te avisa cuando sale una versión nueva.',
    toast: 'Descargando la AppImage de Viciont Studios Launcher…',
  },
};

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const p = String(navigator.userAgentData?.platform || navigator.platform || '');
  if (/android|iphone|ipad|ipod/i.test(ua) || (/mac/i.test(p) && navigator.maxTouchPoints > 1)) return null;
  if (/mac/i.test(p) || /Mac OS X/.test(ua)) return 'mac';
  if (/linux|x11|cros/i.test(p) || /Linux|X11|CrOS/.test(ua)) return 'linux';
  if (/win/i.test(p) || /Windows/.test(ua)) return 'win';
  return null;
}
const PLATFORM = detectPlatform();
const SHOTS = [
  ['inicio', 'Inicio: las instancias que puedes jugar'],
  ['instancia', 'Cada instancia con su fondo y un solo botón: Jugar'],
  ['descargando', 'Descargas rápidas, con velocidad y tiempo restante'],
  ['jugando', 'Mientras juegas, el launcher casi no gasta recursos'],
  ['skins', 'Tus skins con vista 3D'],
  ['login', 'Entra con tu cuenta de Microsoft o con tu nick'],
  ['ajustes', 'Memoria, Java, resolución y más'],
];
let shotIndex = 0;

function setShot(i) {
  shotIndex = (i + SHOTS.length) % SHOTS.length;
  const [file, caption] = SHOTS[shotIndex];
  const img = $('#shot-img');
  img.src = `assets/img/launcher/${file}.webp`;
  img.alt = `Viciont Studios Launcher: ${caption}`;
  $('#shot-cap').textContent = caption;
  $$('[data-shot]').forEach((b) => {
    const on = Number(b.dataset.shot) === shotIndex;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function openShot(i) {
  setShot(i);
  const [file, caption] = SHOTS[shotIndex];
  const box = modal.open(`
    <figure class="shot-view">
      <img src="assets/img/launcher/${file}.webp" alt="${escapeHtml(`Viciont Studios Launcher: ${caption}`)}" width="1600" height="1000">
      <figcaption>
        <button class="btn btn--icon btn--sm" type="button" data-shot-step="-1" aria-label="Captura anterior">${icon('arrowLeft')}</button>
        <span>${escapeHtml(caption)} <span class="mono">${shotIndex + 1}/${SHOTS.length}</span></span>
        <button class="btn btn--icon btn--sm" type="button" data-shot-step="1" aria-label="Captura siguiente">${icon('arrowRight')}</button>
      </figcaption>
    </figure>`, { size: 'shot', label: 'Captura del launcher' });
  box.querySelectorAll('[data-shot-step]').forEach((b) => b.addEventListener('click', () => openShot(shotIndex + Number(b.dataset.shotStep))));
}

function initLauncher() {
  $('#shot-thumbs').innerHTML = SHOTS.map(([file, caption], i) => `
    <button class="shots__thumb${i === 0 ? ' is-active' : ''}" type="button" data-shot="${i}" aria-pressed="${i === 0}" aria-label="${escapeHtml(caption)}">
      <img src="assets/img/launcher/${file}.webp" alt="" loading="lazy" decoding="async" width="160" height="100">
    </button>`).join('');
  $('#shot-thumbs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shot]');
    if (b) setShot(Number(b.dataset.shot));
  });
  $('#shot-main').addEventListener('click', () => openShot(shotIndex));
  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('.shot-view') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    openShot(shotIndex + (e.key === 'ArrowRight' ? 1 : -1));
  });
  const os = PLATFORMS[PLATFORM] || PLATFORMS.win;
  const btn = $('#dl-btn');
  btn.href = `${DL_BASE}/${os.file}`;
  $('#dl-icon').innerHTML = icon(os.icon);
  $('#dl-title').textContent = `Descargar para ${os.name}`;
  $('#dl-file').textContent = os.sub;
  $('#dl-fact').textContent = os.fact;
  $$('.dl-alt__item').forEach((el) => el.classList.toggle('is-current', el.dataset.os === (PLATFORM || 'win')));
  const helps = $('#dl-helps');
  const mine = PLATFORM && helps.querySelector(`[data-os="${PLATFORM}"]`);
  if (mine) helps.prepend(mine);
  btn.addEventListener('click', () => toast(os.toast, { type: 'success' }));
}

const fmtSize = (n) => (n > 0 ? `${(n / 1048576).toFixed(n > 104857600 ? 0 : 1)} MB` : '');

let releaseAsked = false;
async function loadRelease() {
  if (releaseAsked) return;
  releaseAsked = true;
  const KEY = 'vs-launcher-release-2';
  let info = null;
  try { info = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { info = null; }
  if (!info || Date.now() - info.at > 10 * 60000) {
    try {
      const res = await fetch(`https://api.github.com/repos/${LAUNCHER_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = await res.json();
      const assets = Array.isArray(r.assets) ? r.assets : [];
      info = { at: Date.now(), version: String(r.tag_name || '').replace(/^v/i, ''), date: r.published_at || null, assets: assets.map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })) };
      try { sessionStorage.setItem(KEY, JSON.stringify(info)); } catch {}
    } catch (err) {
      console.warn('[viciont] no se pudo leer la última versión del launcher', err);
      return;
    }
  }
  if (/^\d+(\.\d+){1,3}$/.test(info.version)) $('#dl-version').textContent = `Versión ${info.version}`;
  const d = info.date ? new Date(info.date) : null;
  if (d && !Number.isNaN(d.getTime())) $('#dl-date').textContent = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const os = PLATFORMS[PLATFORM] || PLATFORMS.win;
  const file = (info.assets || []).find((a) => os.asset.test(a.name || ''));
  if (!file) return;
  $('#dl-file').textContent = [file.name, fmtSize(file.size)].filter(Boolean).join(' · ');
  if (/^https:\/\/github\.com\/CrissyjuanxD\/Viciont-Studio-Launcher\/releases\/download\//.test(file.url || '')) $('#dl-btn').href = file.url;
}

function renderContact(c) {
  const email = EMAIL_RE.test(c.contact.email) ? c.contact.email : '';
  const mailto = email ? `mailto:${email}` : '#';
  for (const id of ['#contact-email', '#footer-email']) {
    const a = $(id);
    a.textContent = email || 'Correo no disponible';
    a.href = mailto;
  }
  $('#footer-mail').href = mailto;
  $('#mail-btn').href = email ? `${mailto}?subject=${encodeURIComponent(`Comisión para ${c.site.name}`)}` : '#';
  $('#price-range').textContent = c.contact.priceRange;
  $('#price-range').closest('.price').hidden = !c.contact.priceRange && !c.contact.priceNote;
  $('#price-note').textContent = c.contact.priceNote;
  $('#footer-price').textContent = c.contact.priceRange ? `Precios: ${c.contact.priceRange}` : '';

  const services = c.contact.services;
  $('#contact-services').innerHTML = chipsHTML(services);
  $('#footer-services').innerHTML = (services.length ? services : ['Servidores', 'Eventos', 'Plugins', 'Mods'])
    .map((s) => `<li><a href="#contacto" data-route="contacto">${escapeHtml(s)}</a></li>`).join('');

  const select = $('#contact-type');
  const current = select.value;
  select.innerHTML = [...services, 'Otro'].map((s) => `<option>${escapeHtml(s)}</option>`).join('');
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function showLoadError() {
  const msg = location.protocol === 'file:'
    ? 'Abre la web desde un servidor (por ejemplo Cloudflare Pages) para cargar el contenido.'
    : 'No se pudo cargar el contenido. Revisa tu conexión e inténtalo de nuevo.';
  $$('[data-cards]').forEach((g) => { g.innerHTML = emptyHTML(msg, true); });
  $('#team-grid').innerHTML = emptyHTML(msg, true);
  $('#about-text').innerHTML = `<p>${escapeHtml(msg)}</p>`;
  fx.observeReveals(document, { instant: true });
  if (!state.view) route({ initial: true });
}

function openItem(key, id) {
  const sec = state.content?.sections[key];
  const it = sec?.items.find((x) => x.id === id);
  if (!it) return;
  const meta = SECTION_META[key];
  const link = safeUrl(it.link);
  const img = safeImage(it.image);
  const idx = Math.max(0, visible(sec.items).indexOf(it));
  const media = img
    ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(it.title)}">`
    : coverHTML(it.title, idx, `VS-${meta.code}-${pad2(idx + 1)}`);

  const leave = link ? `
    <div class="leave">
      <p class="leave__head">${icon('alert')} Estás a punto de salir de ${escapeHtml(state.content.site.name)}</p>
      <p class="leave__label">Este enlace te llevará a:</p>
      <div class="leave__dest">
        <span class="leave__icon">${icon('globe')}</span>
        <span class="leave__where"><strong>${escapeHtml(domainOf(link))}</strong><code>${escapeHtml(link)}</code></span>
      </div>
      <p class="leave__question">¿Quieres continuar?</p>
    </div>
    <div class="modal__actions">
      <button class="btn btn--ghost" type="button" data-close>Cancelar</button>
      <a class="btn btn--primary" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" data-go>${escapeHtml(it.linkLabel || 'Continuar')} ${icon('external')}</a>
    </div>` : `
    <p class="private-note">${icon('lock')}<span>Este ${escapeHtml(meta.label.toLowerCase())} no tiene un enlace público por ahora.</span></p>
    <div class="modal__actions"><button class="btn btn--primary" type="button" data-close>Entendido</button></div>`;

  modal.open(`
    <div class="item-modal">
      <div class="item-modal__media">${media}${it.badge ? `<span class="card__badge">${escapeHtml(it.badge)}</span>` : ''}</div>
      <div class="item-modal__body">
        <p class="kicker">${icon(meta.icon)} ${escapeHtml(meta.label)}</p>
        <h2 class="item-modal__title" id="modal-title">${escapeHtml(it.title)}</h2>
        ${tagsHTML(it.tags)}
        <div class="rich item-modal__text">${richText(it.description)}</div>
        ${leave}
      </div>
    </div>`, { size: 'lg' });
  modal.content.querySelector('[data-go]')?.addEventListener('click', () => setTimeout(() => modal.close(), 60));
}

function openMember(id) {
  const m = state.content?.team.members.find((x) => x.id === id);
  if (!m) return;
  const socials = m.socials.map((s) => ({ ...s, url: safeUrl(s.url) })).filter((s) => s.url);
  const list = socials.length
    ? `<ul class="social-list">${socials.map((s) => {
      const meta = SOCIAL_TYPES[s.type] || SOCIAL_TYPES.web;
      return `<li><a class="social-item social-item--${s.type}" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
          <span class="social-item__icon">${icon(meta.icon)}</span>
          <span class="social-item__text"><strong>${escapeHtml(meta.label)}</strong><small>${escapeHtml(handleFromUrl(s.url, s.type))}</small></span>
          ${icon('external', 'social-item__go')}
        </a></li>`;
    }).join('')}</ul>`
    : `<p class="profile__empty">${icon('info')} Aún no hay redes configuradas.</p>`;
  modal.open(`
    <div class="profile">
      <div class="profile__banner"></div>
      <div class="avatar profile__avatar">${avatarHTML(m)}</div>
      <h2 class="profile__name" id="modal-title">${escapeHtml(m.name)}${icon('verified', 'member__verified')}</h2>
      ${m.role ? `<span class="role">${escapeHtml(m.role)}</span>` : ''}
      <p class="profile__label">Redes sociales</p>
      ${list}
    </div>`, { size: 'sm' });
}

function updateTitle() {
  const c = state.content;
  if (!c || !state.view) return;
  document.title = state.view === 'about' ? BASE_TITLE : `${labels(c)[state.view]} · ${c.site.name}`;
}

function route({ initial = false } = {}) {
  const key = decodeURIComponent(location.hash.replace(/^#\/?/, '')).toLowerCase();
  const r = ROUTES[key] || ROUTES['sobre-nosotros'];
  showView(r.view, r.anchor, initial);
}

function showView(view, anchor, initial) {
  const changing = state.view !== view;
  const apply = () => {
    state.view = view;
    if (view === 'launcher') loadRelease();
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === view));
    const name = VIEW_ROUTE[view];
    $$('[data-route]').forEach((a) => {
      const on = a.dataset.route === name;
      a.classList.toggle('is-active', on);
      if (a.matches('.nav__link, .mobile-menu__link')) {
        if (on) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
    });
    updateTitle();
    const el = $(`.view[data-view="${view}"]`);
    if (changing) {
      if (!initial) {
        el.querySelectorAll('.reveal.in').forEach((r) => r.classList.remove('in'));
        fx.observeReveals(el);
      }
      el.querySelectorAll('[data-scramble]').forEach((s) => fx.scramble(s, s.dataset.final || s.textContent));
    }
    if (anchor) {
      const target = document.getElementById(anchor);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: changing ? 'instant' : 'smooth', block: 'start' }));
    } else if (!initial) {
      window.scrollTo({ top: 0, behavior: changing ? 'instant' : 'smooth' });
    }
  };
  if (changing && !initial && state.view) fx.glitchTransition(apply);
  else apply();
  closeMenu();
}

function openMenu() {
  const m = $('#mobile-menu');
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('is-open'));
  const t = $('#menu-toggle');
  t.setAttribute('aria-expanded', 'true');
  t.setAttribute('aria-label', 'Cerrar menú');
  document.documentElement.classList.add('is-menu-open');
}

function closeMenu() {
  const m = $('#mobile-menu');
  if (m.hidden) return;
  m.classList.remove('is-open');
  const t = $('#menu-toggle');
  t.setAttribute('aria-expanded', 'false');
  t.setAttribute('aria-label', 'Abrir menú');
  document.documentElement.classList.remove('is-menu-open');
  setTimeout(() => { if (!m.classList.contains('is-open')) m.hidden = true; }, 380);
}

function bindChrome() {
  window.addEventListener('hashchange', () => route());

  document.addEventListener('click', async (e) => {
    const t = e.target;

    const emptySocial = t.closest('[data-social].is-empty');
    if (emptySocial) {
      e.preventDefault();
      const name = { youtube: 'El canal de YouTube', x: 'La cuenta de X', discord: 'El servidor de Discord' }[emptySocial.dataset.social] || 'Esta red';
      toast(`${name} del estudio estará disponible muy pronto.`);
      return;
    }

    const routeLink = t.closest('a[data-route]');
    if (routeLink && routeLink.getAttribute('href') === (location.hash || '#sobre-nosotros')) {
      e.preventDefault();
      const r = ROUTES[routeLink.dataset.route];
      if (r?.anchor) document.getElementById(r.anchor)?.scrollIntoView({ behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
      closeMenu();
      return;
    }

    const member = t.closest('[data-member]');
    if (member) { openMember(member.dataset.member); return; }

    const item = t.closest('[data-open-item]');
    if (item) {
      const raw = item.dataset.openItem;
      const cut = raw.indexOf(':');
      openItem(raw.slice(0, cut), raw.slice(cut + 1));
      return;
    }

    const scrollTo = t.closest('[data-scroll-to]');
    if (scrollTo) { document.getElementById(scrollTo.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth' }); return; }

    if (t.closest('[data-retry]')) { location.reload(); return; }

    if (t.closest('#copy-email')) {
      const email = state.content?.contact.email;
      if (email && await copyText(email)) toast('Correo copiado al portapapeles', { type: 'success' });
      return;
    }

    if (t.closest('#to-top')) window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#menu-toggle').addEventListener('click', () => ($('#mobile-menu').hidden ? openMenu() : closeMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      $('#header').classList.toggle('is-scrolled', window.scrollY > 12);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  $('#contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = state.content?.contact.email;
    if (!email || !EMAIL_RE.test(email)) return;
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    const type = String(f.get('type') || '').trim();
    const message = String(f.get('message') || '').trim();
    const err = $('#contact-error');
    if (message.length < 10) {
      err.textContent = 'Cuéntanos un poco más sobre tu idea (mínimo 10 caracteres).';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const subject = `Comisión: ${type || 'Proyecto'}${name ? ` — ${name}` : ''}`;
    const body = `Hola, ${state.content.site.name}:\n\n${message}\n\n${name ? `— ${name}` : ''}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast('Abriendo tu aplicación de correo…');
  });
}

initLauncher();

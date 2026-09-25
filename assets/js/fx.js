// Efectos electrónicos / glitch de la web.

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------- Texto que se "descifra" ----------
const GLYPHS = '!<>-_\\/[]{}=+*^?#01§$%&@ABCDEFXYZ';

export function scramble(el, text, { duration = 750 } = {}) {
  if (!el) return;
  const target = String(text ?? '');
  cancelAnimationFrame(el._scramble || 0);
  if (reducedMotion() || !target) {
    el.textContent = target;
    return;
  }
  const len = target.length;
  const order = Array.from({ length: len }, (_, i) => (i / len) * 0.65 + (((i * 7919) % 13) / 13) * 0.35);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    let out = '';
    for (let i = 0; i < len; i++) {
      const ch = target[i];
      out += ch === ' ' || t >= order[i] ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) el._scramble = requestAnimationFrame(step);
    else el.textContent = target;
  };
  el._scramble = requestAnimationFrame(step);
}

// ---------- Efecto de escritura en bucle ----------
export function typeLoop(el, words) {
  if (!el) return;
  clearTimeout(el._typing);
  const list = (words || []).filter(Boolean);
  if (!list.length) { el.textContent = ''; return; }
  if (reducedMotion()) { el.textContent = list[0]; return; }
  let wi = 0, ci = 0, deleting = false;
  const schedule = (ms) => { el._typing = setTimeout(tick, ms); };
  function tick() {
    const w = list[wi % list.length];
    if (!deleting) {
      ci++;
      el.textContent = w.slice(0, ci);
      if (ci >= w.length) { deleting = true; return schedule(1600); }
      return schedule(45 + Math.random() * 55);
    }
    ci--;
    el.textContent = w.slice(0, ci);
    if (ci <= 0) { deleting = false; wi++; return schedule(320); }
    return schedule(26);
  }
  el.textContent = '';
  schedule(500);
}

// ---------- Contadores ----------
export function countUp(el, to, { duration = 1100, pad = 2 } = {}) {
  if (!el) return;
  const fmt = (n) => String(n).padStart(pad, '0');
  if (reducedMotion()) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(Math.round(to * e));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- Aparición al hacer scroll ----------
let io = null;
export function observeReveals(scope = document, { instant = false } = {}) {
  const els = [...scope.querySelectorAll('.reveal:not(.in)')];
  if (instant || reducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  io ??= new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('in');
      io.unobserve(en.target);
      en.target.dispatchEvent(new CustomEvent('reveal'));
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  els.forEach((el) => io.observe(el));
}

// ---------- Inclinación 3D de tarjetas ----------
export function bindTilt(root = document) {
  if (!finePointer() || reducedMotion()) return;
  root.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('[data-tilt]');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  }, { passive: true });
  root.addEventListener('pointerout', (e) => {
    const card = e.target.closest?.('[data-tilt]');
    if (card && !card.contains(e.relatedTarget)) {
      for (const p of ['--rx', '--ry', '--mx', '--my']) card.style.removeProperty(p);
    }
  });
}

// ---------- Ráfagas de glitch aleatorias ----------
export function startGlitchBursts() {
  if (reducedMotion()) return;
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };
  const loop = () => {
    if (!document.hidden) {
      const els = [...document.querySelectorAll('.glitch, .glitch-img')].filter(inView);
      if (els.length) {
        const el = els[(Math.random() * els.length) | 0];
        el.classList.add('is-bursting');
        setTimeout(() => el.classList.remove('is-bursting'), 480);
      }
    }
    setTimeout(loop, 1700 + Math.random() * 3000);
  };
  setTimeout(loop, 1400);
}

// ---------- Transición glitch entre secciones ----------
export function glitchTransition(swap) {
  const layer = document.getElementById('transition-fx');
  if (!layer || reducedMotion()) { swap(); return; }
  layer.innerHTML = '';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    const h = 4 + Math.random() * 14;
    s.style.top = `${Math.random() * (100 - h)}%`;
    s.style.height = `${h}%`;
    s.style.setProperty('--d', `${(Math.random() * 90) | 0}ms`);
    s.style.setProperty('--x', `${(Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 40)}%`);
    s.className = i % 2 ? 'is-pink' : 'is-purple';
    layer.appendChild(s);
  }
  layer.classList.remove('is-on');
  void layer.offsetWidth;
  layer.classList.add('is-on');
  document.documentElement.classList.add('is-switching');
  setTimeout(swap, 170);
  setTimeout(() => {
    layer.classList.remove('is-on');
    document.documentElement.classList.remove('is-switching');
  }, 520);
}

// ---------- Pantalla de arranque ----------
export function bootScreen() {
  const el = document.getElementById('boot');
  let seen = false;
  try { seen = sessionStorage.getItem('vs-booted') === '1'; } catch { /* sin almacenamiento */ }
  if (!el) return { done: () => {} };
  if (seen || reducedMotion()) {
    el.classList.add('boot--quick');
  } else {
    const lines = [...el.querySelectorAll('.boot__line')];
    lines.forEach((l, i) => setTimeout(() => l.classList.add('on'), 120 + i * 230));
  }
  const minTime = seen || reducedMotion() ? 0 : 1250;
  const t0 = performance.now();
  return {
    done() {
      const wait = Math.max(0, minTime - (performance.now() - t0));
      setTimeout(() => {
        el.classList.add('boot--out');
        try { sessionStorage.setItem('vs-booted', '1'); } catch { /* sin almacenamiento */ }
        setTimeout(() => el.remove(), 650);
      }, wait);
    },
  };
}

// ---------- Brillo que sigue al cursor ----------
export function cursorGlow() {
  if (!finePointer() || reducedMotion()) return;
  const g = document.createElement('div');
  g.className = 'cursor-glow';
  g.setAttribute('aria-hidden', 'true');
  document.body.appendChild(g);
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = 0;
  const step = () => {
    x += (tx - x) * 0.14;
    y += (ty - y) * 0.14;
    g.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.4 ? requestAnimationFrame(step) : 0;
  };
  window.addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    g.classList.add('on');
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: true });
  document.addEventListener('pointerleave', () => g.classList.remove('on'));
}

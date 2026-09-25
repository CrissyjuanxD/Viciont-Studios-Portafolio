// Componentes de interfaz compartidos: ventana modal, avisos y confirmaciones.
import { icon, escapeHtml } from './core.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createModal(root = document.getElementById('modal')) {
  const dialog = root.querySelector('.modal__dialog');
  const content = root.querySelector('.modal__content');
  let lastFocus = null;
  let onCloseCb = null;
  let locked = false;
  let closeTimer = 0;

  function open(html, { size = '', label = '', onClose = null, lock = false } = {}) {
    clearTimeout(closeTimer);
    if (root.hidden) lastFocus = document.activeElement;
    content.innerHTML = html;
    dialog.className = `modal__dialog${size ? ` modal__dialog--${size}` : ''}`;
    if (content.querySelector('#modal-title')) {
      dialog.setAttribute('aria-labelledby', 'modal-title');
      dialog.removeAttribute('aria-label');
    } else {
      dialog.removeAttribute('aria-labelledby');
      dialog.setAttribute('aria-label', label || 'Ventana');
    }
    onCloseCb = onClose;
    locked = lock;
    root.classList.toggle('is-locked', lock);
    root.hidden = false;
    root.classList.remove('is-closing');
    document.documentElement.classList.add('is-locked');
    requestAnimationFrame(() => {
      const target = content.querySelector('[autofocus]') || content.querySelector(FOCUSABLE) || dialog;
      target.focus({ preventScroll: true });
    });
    return content;
  }

  function close(force = false) {
    if (root.hidden || (locked && !force)) return;
    root.classList.add('is-closing');
    document.documentElement.classList.remove('is-locked');
    closeTimer = setTimeout(() => {
      root.hidden = true;
      root.classList.remove('is-closing');
      content.innerHTML = '';
    }, 180);
    const cb = onCloseCb;
    onCloseCb = null;
    locked = false;
    cb?.();
    lastFocus?.focus?.({ preventScroll: true });
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  return {
    open,
    close,
    get isOpen() { return !root.hidden; },
    setLocked(v) { locked = v; root.classList.toggle('is-locked', v); },
    content,
  };
}

export function toast(message, { type = 'info', timeout = 2800 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'sparkle')}<span></span>`;
  el.querySelector('span').textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => el.remove(), 320);
  }, timeout);
}

export function confirmDialog(modal, { title, text = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const c = modal.open(`
      <div class="confirm">
        <div class="confirm__icon${danger ? ' is-danger' : ''}">${icon(danger ? 'alert' : 'info')}</div>
        <h2 class="confirm__title" id="modal-title">${escapeHtml(title)}</h2>
        ${text ? `<p class="confirm__text">${escapeHtml(text)}</p>` : ''}
        <div class="modal__actions">
          <button class="btn btn--ghost" type="button" data-close>${escapeHtml(cancel)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-ok autofocus>${escapeHtml(ok)}</button>
        </div>
      </div>`, { size: 'sm', onClose: () => resolve(result) });
    c.querySelector('[data-ok]').addEventListener('click', () => {
      result = true;
      modal.close();
    });
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

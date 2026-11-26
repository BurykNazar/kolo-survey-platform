import { csrf } from './core.js';

/* ── Inline form errors ─────────────────────────────────────────────────── */

function clearFormErrors(form) {
  form.querySelectorAll('.field.is-invalid').forEach((field) => field.classList.remove('is-invalid'));
  form.querySelectorAll('[data-error]').forEach((node) => { node.textContent = ''; });
  const box = form.querySelector('[data-form-error]');
  if (box) {
    box.textContent = '';
    box.classList.remove('is-visible');
  }
}

function applyFormErrors(form, errors = {}, message = '') {
  let first = null;
  let count = 0;

  for (const [key, value] of Object.entries(errors || {})) {
    if (key === '_global') {
      const box = form.querySelector('[data-form-error]');
      if (box) {
        box.textContent = value;
        box.classList.add('is-visible');
      }
      continue;
    }

    const field = form.querySelector(`[data-field="${CSS.escape(key)}"]`);
    if (field) {
      field.classList.add('is-invalid');
      const target = field.querySelector('[data-error]');
      if (target) target.textContent = value;
      if (!first) first = field;
      count += 1;
    }
  }

  const box = form.querySelector('[data-form-error]');
  if (count === 0 && message && box) {
    box.textContent = message;
    box.classList.add('is-visible');
  }

  if (first) {
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    first.querySelector('input, textarea, button, select')?.focus({ preventScroll: true });
  }
}

function setLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.dataset.original = button.innerHTML;
    button.classList.add('is-loading');
    button.disabled = true;
    button.innerHTML = `<span class="btn__spinner"></span><span class="btn__label">${button.textContent.trim() || 'Зберігаємо'}</span>`;
  } else {
    button.classList.remove('is-loading');
    button.disabled = false;
    if (button.dataset.original) {
      button.innerHTML = button.dataset.original;
      delete button.dataset.original;
    }
  }
}

async function postJson(url, body = {}, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'fetch',
      'X-CSRF-Token': csrf()
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({
    ok: false,
    message: 'Сервер повернув неочікувану відповідь. Оновіть сторінку.'
  }));
  return { response, data };
}

function replaceRegion(form, data) {
  const selector = form.dataset.region;
  if (!selector || !data.html) return false;
  const region = document.querySelector(selector);
  if (!region) return false;
  region.innerHTML = data.html;
  return true;
}


export { applyFormErrors, clearFormErrors, postJson, replaceRegion, setLoading };


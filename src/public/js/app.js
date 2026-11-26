/* Kolo — interactions */

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

const SELECT_ICON = '<svg class="icon select__chevron" width="16" height="16" aria-hidden="true"><use href="/img/icons.svg#i-chevron-down"></use></svg>';
const CHECK_ICON = '<svg class="icon" width="16" height="16" aria-hidden="true"><use href="/img/icons.svg#i-check"></use></svg>';

function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="/img/icons.svg#i-${name}"></use></svg>`;
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */

function showToast(message, tone = 'ok') {
  if (!message) return;
  let stack = document.getElementById('toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toasts';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${tone === 'error' ? 'err' : 'ok'}`;
  toast.setAttribute('data-toast', '');
  toast.innerHTML = `${icon(tone === 'error' ? 'alert' : 'check-circle', 18)}<span></span><button type="button" class="toast__close" aria-label="Закрити">${icon('x', 15)}</button>`;
  toast.querySelector('span').textContent = message;
  toast.querySelector('.toast__close').addEventListener('click', () => dismissToast(toast));
  stack.appendChild(toast);
  setTimeout(() => dismissToast(toast), 5200);
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains('is-leaving')) return;
  toast.classList.add('is-leaving');
  setTimeout(() => toast.remove(), 220);
}

document.addEventListener('click', (event) => {
  const close = event.target.closest('[data-toast-close]');
  if (close) dismissToast(close.closest('[data-toast]'));
});

document.querySelectorAll('[data-toast]').forEach((toast) => {
  setTimeout(() => dismissToast(toast), 5200);
});

/* ── Dialogs ────────────────────────────────────────────────────────────── */

function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  document.body.classList.add('is-locked');
}

function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  dialog.close();
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-dialog]');
  if (opener) {
    const dialog = document.getElementById(opener.dataset.openDialog);
    if (dialog) {
      const form = dialog.querySelector('form[data-reset-on-open]');
      if (form) {
        form.reset();
        form.querySelectorAll('select[data-select]').forEach(refreshSelect);
        clearFormErrors(form);
      }
      openDialog(dialog);
    }
  }

  const closer = event.target.closest('[data-close-dialog]');
  if (closer) {
    closeDialog(closer.closest('dialog'));
  }
});

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('is-locked');
  });
});

/* ── Header & navigation ────────────────────────────────────────────────── */

const head = document.querySelector('.site-head');
if (head) {
  const onScroll = () => head.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

const menuToggle = document.querySelector('[data-menu-toggle]');
const siteNav = document.getElementById('site-nav');
if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    menuToggle.innerHTML = icon(open ? 'x' : 'menu', 22);
  });
  siteNav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      siteNav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

document.addEventListener('click', (event) => {
  document.querySelectorAll('details.user-menu[open]').forEach((menu) => {
    if (!menu.contains(event.target)) menu.removeAttribute('open');
  });
});

/* ── Password visibility ────────────────────────────────────────────────── */

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-password-toggle]');
  if (!toggle) return;
  const input = toggle.closest('.password')?.querySelector('input');
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  toggle.setAttribute('aria-label', reveal ? 'Сховати пароль' : 'Показати пароль');
  toggle.innerHTML = icon(reveal ? 'eye-off' : 'eye', 17);
});

/* ── Custom selects ─────────────────────────────────────────────────────── */

function refreshSelect(select) {
  const wrap = select.closest('.select');
  if (!wrap) return;
  const label = wrap.querySelector('[data-select-label]');
  const selected = select.options[select.selectedIndex];
  if (label) label.textContent = selected ? selected.textContent : '';
  wrap.querySelectorAll('.select__option').forEach((option) => {
    option.setAttribute('aria-selected', String(option.dataset.value === select.value));
  });
}

function buildSelect(select) {
  if (select.dataset.enhanced === 'true') return;
  select.dataset.enhanced = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'select';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  let labelId = '';
  const label = document.querySelector(`label[for="${select.id}"]`);
  if (label) {
    if (!label.id) label.id = `${select.id}Label`;
    labelId = label.id;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'select__button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  if (labelId) button.setAttribute('aria-labelledby', labelId);
  button.innerHTML = `<span class="select__label" data-select-label></span>${SELECT_ICON}`;
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  const popover = document.createElement('div');
  popover.className = 'select__popover';
  popover.setAttribute('role', 'listbox');
  popover.hidden = true;

  const rebuild = () => {
    popover.replaceChildren();
    Array.from(select.options).forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'select__option';
      item.setAttribute('role', 'option');
      item.dataset.value = option.value;
      item.innerHTML = `<span></span><span class="select__tick">${CHECK_ICON}</span>`;
      item.querySelector('span').textContent = option.textContent;
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        refreshSelect(select);
        close();
      });
      popover.appendChild(item);
    });
  };

  const open = () => {
    document.querySelectorAll('.select[data-open="true"]').forEach((other) => {
      other.dataset.open = 'false';
      other.querySelector('.select__popover').hidden = true;
      other.querySelector('.select__button').setAttribute('aria-expanded', 'false');
    });
    rebuild();
    refreshSelect(select);
    wrap.dataset.open = 'true';
    popover.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    popover.querySelector('.select__option[aria-selected="true"]')?.focus();
  };

  const close = () => {
    wrap.dataset.open = 'false';
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', () => (popover.hidden ? open() : close()));
  button.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      open();
    }
    if (event.key === 'Escape') close();
  });
  popover.addEventListener('keydown', (event) => {
    const options = [...popover.querySelectorAll('.select__option')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      options[Math.max(index - 1, 0)]?.focus();
    } else if (event.key === 'Escape') {
      close();
      button.focus();
    }
  });
  select.addEventListener('change', () => refreshSelect(select));

  wrap.appendChild(button);
  wrap.appendChild(popover);
  refreshSelect(select);
}

document.querySelectorAll('select[data-select]').forEach(buildSelect);

document.addEventListener('click', (event) => {
  document.querySelectorAll('.select[data-open="true"]').forEach((wrap) => {
    if (!wrap.contains(event.target)) {
      wrap.dataset.open = 'false';
      const popover = wrap.querySelector('.select__popover');
      if (popover) popover.hidden = true;
      wrap.querySelector('.select__button')?.setAttribute('aria-expanded', 'false');
    }
  });
});

/* ── Date picker ────────────────────────────────────────────────────────── */

const UA_MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const UA_WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function initDatepicker(root) {
  if (root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';

  const input = root.querySelector('[data-date-value]') || root.querySelector('.date__input');
  const display = root.querySelector('[data-date-display]') || input;
  const trigger = root.querySelector('[data-date-toggle]');
  let popover = null;
  let view = new Date();

  const pretty = (value) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  };

  const commit = (value) => {
    input.value = value;
    display.value = pretty(value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const close = () => {
    popover?.remove();
    popover = null;
  };

  const render = () => {
    if (!popover) return;
    const selected = input.value;
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const today = iso(new Date());

    let cells = '';
    for (let i = 0; i < startOffset; i += 1) cells += '<span></span>';
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(year, month, day);
      const value = iso(date);
      const classes = ['calendar__day'];
      if (value === selected) classes.push('is-selected');
      if (value === today) classes.push('is-today');
      const isPast = value < today;
      const label = `${day} ${UA_MONTHS[month]} ${year}`;
      cells += `<button class="${classes.join(' ')}" type="button" data-day="${value}" aria-label="${label}" aria-pressed="${value === selected}" ${isPast ? 'disabled' : ''}>${day}</button>`;
    }

    popover.innerHTML = `
      <div class="calendar__head">
        <span class="calendar__month">${UA_MONTHS[month]} ${year}</span>
        <span class="calendar__nav">
          <button class="icon-btn" type="button" data-nav="-1" aria-label="Попередній місяць">${icon('chevron-left', 16)}</button>
          <button class="icon-btn" type="button" data-nav="1" aria-label="Наступний місяць">${icon('chevron-right', 16)}</button>
        </span>
      </div>
      <div class="calendar__week">${UA_WEEK.map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="calendar__grid">${cells}</div>
      <div class="calendar__foot">
        <button class="calendar__link" type="button" data-clear>Очистити</button>
        <button class="calendar__link" type="button" data-today>Сьогодні</button>
      </div>`;

    popover.querySelectorAll('[data-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        view = new Date(year, month + Number(button.dataset.nav), 1);
        render();
      });
    });
    popover.querySelectorAll('[data-day]').forEach((button) => {
      button.addEventListener('click', () => {
        commit(button.dataset.day);
        close();
      });
    });
    popover.querySelector('[data-clear]').addEventListener('click', () => {
      commit('');
      close();
    });
    popover.querySelector('[data-today]').addEventListener('click', () => {
      commit(iso(new Date()));
      close();
    });
  };

  const open = () => {
    close();
    const value = input.value ? new Date(`${input.value}T12:00:00`) : new Date();
    view = Number.isNaN(value.getTime()) ? new Date() : value;
    popover = document.createElement('div');
    popover.className = 'calendar';
    root.appendChild(popover);
    const rect = root.getBoundingClientRect();
    if (rect.bottom + 336 > window.innerHeight && rect.top > 360) {
      popover.classList.add('calendar--up');
    }
    render();
  };

  trigger?.addEventListener('click', () => (popover ? close() : open()));
  display.addEventListener('click', () => (popover ? close() : open()));
  document.addEventListener('click', (event) => {
    if (popover && !root.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && popover) close();
  });
}

document.querySelectorAll('[data-datepicker]').forEach(initDatepicker);

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

function resetEnhancedForm(form) {
  form.reset();
  form.querySelectorAll('select[data-select]').forEach(refreshSelect);
}

/* ── AJAX forms ─────────────────────────────────────────────────────────── */

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-ajax-form]');
  if (!form) return;
  event.preventDefault();

  if (form.dataset.busy === 'true') return;
  form.dataset.busy = 'true';
  clearFormErrors(form);

  const submit = form.querySelector('[type="submit"]');
  setLoading(submit, true);

  try {
    const response = await fetch(form.action || window.location.href, {
      method: (form.method || 'POST').toUpperCase(),
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'fetch',
        'X-CSRF-Token': csrf()
      },
      body: new URLSearchParams(new FormData(form))
    });

    const data = await response.json().catch(() => null);

    if (!data) {
      showToast('Не вдалося отримати відповідь. Оновіть сторінку.', 'error');
      return;
    }

    if (!response.ok || data.ok === false) {
      applyFormErrors(form, data.errors, data.message || 'Перевірте заповнені поля.');
      if (data.errors && Object.keys(data.errors).length === 0 && data.message) showToast(data.message, 'error');
      return;
    }

    if (data.html) {
      const replaced = replaceRegion(form, data);
      if (!replaced && form.dataset.questionForm !== undefined) {
        document.getElementById('questions-region')?.replaceChildren();
        const region = document.getElementById('questions-region');
        if (region) region.innerHTML = data.html;
      }
    }

    if (form.dataset.surveyMetaForm !== undefined && data.survey) {
      const title = document.querySelector('[data-survey-title]');
      if (title) title.textContent = data.survey.title;
      const chip = document.querySelector('[data-status-chip]');
      if (chip) {
        const labels = { draft: 'Чернетка', active: 'Активне', closed: 'Завершене' };
        const tones = { draft: 'neutral', active: 'positive', closed: 'muted' };
        chip.textContent = labels[data.survey.status] || data.survey.status;
        chip.className = `chip chip--${tones[data.survey.status] || 'neutral'}`;
      }
      document.title = `${data.survey.title} — Kolo`;
    }

    if (form.action.endsWith('/studio/profile') && data.user) {
      document.querySelectorAll('.user-menu__id strong').forEach((node) => { node.textContent = data.user.full_name; });
      const avatar = document.querySelector('.user-menu__trigger .avatar');
      if (avatar) {
        avatar.textContent = data.user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      }
    }

    showToast(data.message || 'Збережено.');

    const dialog = form.closest('dialog');
    if (dialog) closeDialog(dialog);

    if (form.dataset.redirect) {
      window.location.assign(form.dataset.redirect);
      return;
    }

    if (data.redirect && form.hasAttribute('data-redirect-on-success')) {
      window.location.assign(data.redirect);
      return;
    }

    if (!dialog && form.dataset.preserve !== 'true') {
      form.reset();
      form.querySelectorAll('select[data-select]').forEach(refreshSelect);
      form.querySelectorAll('[data-counted]').forEach((input) => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  } catch (error) {
    console.error(error);
    showToast('Мережа не відповіла. Спробуйте ще раз.', 'error');
  } finally {
    form.dataset.busy = 'false';
    setLoading(submit, false);
  }
});

/* ── Confirm dialog ─────────────────────────────────────────────────────── */

const confirmDialog = document.getElementById('confirmDialog');
let confirmConfig = null;

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-confirm]');
  if (!trigger || !confirmDialog) return;

  confirmConfig = {
    endpoint: trigger.dataset.confirmEndpoint,
    body: trigger.dataset.confirmBody ? JSON.parse(trigger.dataset.confirmBody) : {},
    removeTarget: trigger.dataset.removeTarget,
    region: trigger.dataset.region,
    redirect: trigger.dataset.redirect,
    label: trigger.dataset.confirmLabel
  };

  confirmDialog.querySelector('[data-confirm-title]').textContent = trigger.dataset.confirmTitle || 'Підтвердіть дію';
  confirmDialog.querySelector('[data-confirm-text]').textContent = trigger.dataset.confirmText || '';
  confirmDialog.querySelector('[data-confirm-ok] .btn__label').textContent = confirmConfig.label || 'Підтвердити';
  const error = confirmDialog.querySelector('[data-confirm-error]');
  error.textContent = '';
  error.classList.remove('is-visible');

  openDialog(confirmDialog);
});

confirmDialog?.querySelector('[data-confirm-ok]')?.addEventListener('click', async () => {
  if (!confirmConfig) return;
  const button = confirmDialog.querySelector('[data-confirm-ok]');
  setLoading(button, true);

  try {
    const { response, data } = await postJson(confirmConfig.endpoint, confirmConfig.body);
    if (!response.ok || data.ok === false) {
      const error = confirmDialog.querySelector('[data-confirm-error]');
      error.textContent = data.message || 'Не вдалося виконати дію.';
      error.classList.add('is-visible');
      return;
    }

    if (confirmConfig.region && data.html) {
      const region = document.querySelector(confirmConfig.region);
      if (region) region.innerHTML = data.html;
    }

    if (confirmConfig.removeTarget) {
      const target = document.querySelector(confirmConfig.removeTarget);
      if (target) {
        target.classList.add('is-removing');
        setTimeout(() => target.remove(), 240);
      }
    }

    showToast(data.message || 'Готово.');
    closeDialog(confirmDialog);

    if (confirmConfig.redirect || data.redirect) {
      window.location.assign(confirmConfig.redirect || data.redirect);
    }
  } catch (error) {
    console.error(error);
    showToast('Не вдалося виконати дію.', 'error');
  } finally {
    setLoading(button, false);
    confirmConfig = null;
  }
});

/* ── Filters & search ───────────────────────────────────────────────────── */

const catalogSearch = document.querySelector('[data-catalog-search]');
if (catalogSearch) {
  const cards = [...document.querySelectorAll('[data-card]')];
  const empty = document.querySelector('[data-catalog-empty]');

  const apply = () => {
    const query = catalogSearch.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const match = !query || card.dataset.search.includes(query);
      card.classList.toggle('is-hidden', !match);
      if (match) visible += 1;
    });
    if (empty) {
      if (cards.length === 0) {
        empty.classList.remove('is-hidden');
      } else {
        empty.classList.toggle('is-hidden', visible > 0);
        const text = empty.querySelector('[data-catalog-empty-text]');
        if (text && visible === 0) text.textContent = 'Спробуйте інший запит або оберіть іншу тему.';
      }
    }
  };

  catalogSearch.addEventListener('input', apply);
}

const listSearch = document.querySelector('[data-list-search]');
if (listSearch) {
  const selector = document.querySelector('[data-response-list]') ? '[data-attempt]' : '[data-survey-row]';
  const rows = [...document.querySelectorAll(selector)];
  listSearch.addEventListener('input', () => {
    const query = listSearch.value.trim().toLowerCase();
    rows.forEach((row) => {
      row.classList.toggle('is-hidden', Boolean(query) && !row.dataset.search.includes(query));
    });
  });
}

const responseFilter = document.querySelector('[data-response-filter]');
if (responseFilter) {
  responseFilter.addEventListener('change', () => {
    const value = responseFilter.value;
    const query = (document.querySelector('[data-list-search]')?.value || '').trim().toLowerCase();
    document.querySelectorAll('[data-attempt]').forEach((attempt) => {
      const surveyMatch = !value || attempt.dataset.surveyId === value;
      const searchMatch = !query || attempt.dataset.search.includes(query);
      attempt.classList.toggle('is-hidden', !surveyMatch || !searchMatch);
    });
  });
}

/* ── Copy survey ────────────────────────────────────────────────────────── */

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-copy-survey]');
  if (!trigger) return;
  const dialog = document.getElementById('copySurveyDialog');
  if (!dialog) return;
  const form = dialog.querySelector('form');
  form.action = `/studio/surveys/${trigger.dataset.surveyId}/copy`;
  dialog.querySelector('[data-copy-source]').textContent = trigger.dataset.surveyTitle;
  const title = dialog.querySelector('#copyTitle');
  if (title) title.value = `Копія — ${trigger.dataset.surveyTitle}`;
  openDialog(dialog);
});

/* ── Copy link ──────────────────────────────────────────────────────────── */

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-copy-link]');
  if (!trigger) return;
  const url = new URL(trigger.dataset.copyLink, window.location.origin).toString();
  try {
    await navigator.clipboard.writeText(url);
    showToast('Посилання скопійовано.');
  } catch {
    showToast(url);
  }
});

/* ── Character counters ─────────────────────────────────────────────────── */

function updateCounter(input) {
  const counter = document.querySelector(`[data-count-for="${input.id}"]`);
  if (!counter) return;
  counter.textContent = `${input.value.length} / 2000`;
}

document.querySelectorAll('[data-counted]').forEach((input) => {
  updateCounter(input);
  input.addEventListener('input', () => updateCounter(input));
});

/* ── Survey runner ──────────────────────────────────────────────────────── */

const surveyForm = document.querySelector('[data-survey-form]');
if (surveyForm) {
  const questions = [...surveyForm.querySelectorAll('[data-question]')];
  const progress = document.querySelector('[data-runner-progress]');

  const updateProgress = () => {
    if (!progress) return;
    const answered = questions.filter((question) => {
      const checked = question.querySelector('input:checked');
      if (checked) return true;
      const textarea = question.querySelector('textarea');
      return textarea && textarea.value.trim().length > 0;
    }).length;
    progress.style.width = `${questions.length ? (answered / questions.length) * 100 : 0}%`;
  };

  surveyForm.addEventListener('change', (event) => {
    updateProgress();
    const question = event.target.closest('[data-question]');
    if (question) question.classList.remove('is-invalid');
  });
  surveyForm.addEventListener('input', (event) => {
    updateProgress();
    const question = event.target.closest('[data-question]');
    if (question) question.classList.remove('is-invalid');
  });
  updateProgress();

  surveyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = surveyForm.querySelector('[data-submit]');
    setLoading(submit, true);

    try {
      const response = await fetch(surveyForm.dataset.endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'fetch',
          'X-CSRF-Token': csrf()
        },
        body: new URLSearchParams(new FormData(surveyForm))
      });
      const data = await response.json().catch(() => null);

      if (!data) {
        showToast('Не вдалося надіслати відповіді. Оновіть сторінку.', 'error');
        return;
      }

      if (!response.ok || data.ok === false) {
        let first = null;
        document.querySelectorAll('[data-question]').forEach((question) => {
          question.classList.remove('is-invalid');
          const error = question.querySelector('[data-question-error] span');
          if (error) error.textContent = '';
        });

        for (const [key, message] of Object.entries(data.errors || {})) {
          const id = key.replace('q_', '');
          const question = document.querySelector(`[data-question][data-question-id="${CSS.escape(id)}"]`);
          if (!question) continue;
          question.classList.add('is-invalid');
          const error = question.querySelector('[data-question-error] span');
          if (error) error.textContent = message;
          if (!first) first = question;
        }

        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(data.message || 'Перевірте виділені питання.', 'error');
        return;
      }

      if (data.html) {
        document.querySelectorAll('[data-toast]').forEach((toast) => dismissToast(toast));
        const main = document.getElementById('main');
        main.innerHTML = `<div class="wrap">${data.html}</div>`;
        document.title = 'Дякуємо — Kolo';
        window.scrollTo({ top: 0, behavior: 'auto' });
      } else if (data.redirect) {
        window.location.assign(data.redirect);
      }
    } catch (error) {
      console.error(error);
      showToast('Мережа не відповіла. Спробуйте ще раз.', 'error');
    } finally {
      setLoading(submit, false);
    }
  });
}

/* ── Builder: question modal ────────────────────────────────────────────── */

const questionDialog = document.getElementById('questionDialog');
const questionForm = questionDialog?.querySelector('[data-question-form]');
const optionEditor = questionDialog?.querySelector('[data-option-editor]');
const optionsField = questionDialog?.querySelector('[data-options-field]');

function optionRow(value = '', id = '') {
  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML = `
    <span class="option-row__index option-row__drag"></span>
    <input class="input" name="options" maxlength="160" placeholder="Варіант відповіді">
    <input type="hidden" name="option_ids" value="">
    <button class="icon-btn icon-btn--danger" type="button" data-remove-option aria-label="Прибрати варіант">${icon('trash', 15)}</button>`;
  row.querySelector('input[name="options"]').value = value;
  row.querySelector('input[name="option_ids"]').value = id;
  return row;
}

function renumberOptions() {
  if (!optionEditor) return;
  const rows = [...optionEditor.querySelectorAll('.option-row')];
  rows.forEach((row, index) => {
    row.querySelector('.option-row__index').textContent = index + 1;
    const remove = row.querySelector('[data-remove-option]');
    remove.disabled = rows.length <= 2;
    remove.style.opacity = rows.length <= 2 ? '0.35' : '';
  });
}

function addOption(value = '', id = '') {
  if (!optionEditor) return;
  optionEditor.appendChild(optionRow(value, id));
  renumberOptions();
}

questionDialog?.querySelector('[data-add-option]')?.addEventListener('click', () => {
  if (optionEditor && optionEditor.querySelectorAll('.option-row').length >= 20) return;
  addOption();
  optionEditor.lastElementChild?.querySelector('input[name="options"]')?.focus();
});

optionEditor?.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove-option]');
  if (!remove) return;
  if (optionEditor.querySelectorAll('.option-row').length <= 2) return;
  remove.closest('.option-row').remove();
  renumberOptions();
});

function syncOptionsVisibility() {
  if (!questionForm || !optionsField) return;
  const type = questionForm.querySelector('input[name="question_type"]:checked')?.value;
  const isChoice = type === 'single_choice' || type === 'multiple_choice';
  optionsField.classList.toggle('is-hidden', !isChoice);
  optionsField.querySelectorAll('input').forEach((input) => {
    input.disabled = !isChoice;
  });
}

questionForm?.addEventListener('change', (event) => {
  if (event.target.name === 'question_type') syncOptionsVisibility();
});

function openQuestionModal(mode, data = {}) {
  if (!questionForm || !questionDialog) return;
  clearFormErrors(questionForm);
  questionForm.reset();
  optionEditor.replaceChildren();

  const isEdit = mode === 'edit';
  questionDialog.querySelector('[data-question-modal-title]').textContent = isEdit ? 'Редагувати питання' : 'Нове питання';
  questionForm.action = isEdit ? data.endpoint : questionForm.dataset.createAction || questionForm.action;
  questionForm.dataset.endpoint = isEdit ? data.endpoint : '';
  questionForm.querySelector('[data-field="question_type"]');

  if (isEdit) {
    questionForm.querySelector('#questionText').value = data.text || '';
    questionForm.querySelector('#questionHint').value = data.hint || '';
    const type = data.type || 'single_choice';
    const radio = questionForm.querySelector(`input[name="question_type"][value="${type}"]`);
    if (radio) radio.checked = true;
    questionForm.querySelector('input[name="is_required"]').checked = Boolean(data.required);
    (data.options || []).forEach((option) => addOption(option.text, String(option.id)));
    if (!data.options || data.options.length < 2) {
      addOption();
      addOption();
    }
  } else {
    questionForm.querySelector('input[name="single_choice"]');
    const radio = questionForm.querySelector('input[name="question_type"][value="single_choice"]');
    if (radio) radio.checked = true;
    questionForm.querySelector('input[name="is_required"]').checked = true;
    addOption();
    addOption();
  }

  renumberOptions();
  syncOptionsVisibility();
  openDialog(questionDialog);
  questionForm.querySelector('#questionText')?.focus();
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-add-question]')) {
    const form = document.querySelector('[data-question-form]');
    if (form && !form.dataset.createAction) {
      form.dataset.createAction = form.action;
    }
    openQuestionModal('create');
  }

  const edit = event.target.closest('[data-edit-question]');
  if (edit) {
    let payload = {};
    try {
      payload = JSON.parse(edit.dataset.question);
    } catch {
      payload = {};
    }
    openQuestionModal('edit', { ...payload, endpoint: edit.dataset.endpoint });
  }
});

document.addEventListener('click', async (event) => {
  const move = event.target.closest('[data-move-question]');
  if (!move) return;
  move.disabled = true;
  try {
    const { response, data } = await postJson(move.dataset.endpoint, { direction: move.dataset.direction });
    if (!response.ok || data.ok === false) {
      showToast(data.message || 'Не вдалося змінити порядок.', 'error');
      return;
    }
    const region = document.getElementById('questions-region');
    if (region && data.html) region.innerHTML = data.html;
    showToast(data.message || 'Порядок оновлено.');
  } catch {
    showToast('Не вдалося змінити порядок.', 'error');
  } finally {
    move.disabled = false;
  }
});

/* ── Categories ─────────────────────────────────────────────────────────── */

const categoryDialog = document.getElementById('categoryDialog');
const categoryForm = categoryDialog?.querySelector('[data-category-form]');
const categoryName = categoryForm?.querySelector('#categoryName');
const categoryCode = categoryForm?.querySelector('#categoryCode');
let codeTouched = false;

categoryCode?.addEventListener('input', () => { codeTouched = true; });

const translit = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y',
  і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia'
};

function slugify(value) {
  return value
    .toLowerCase()
    .split('')
    .map((letter) => translit[letter] ?? letter)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

categoryName?.addEventListener('input', () => {
  if (!codeTouched && categoryCode) categoryCode.value = slugify(categoryName.value);
});

function openCategoryModal(mode, data = {}) {
  if (!categoryForm || !categoryDialog) return;
  clearFormErrors(categoryForm);
  categoryForm.reset();
  codeTouched = mode === 'edit';
  categoryForm.dataset.mode = mode;
  categoryForm.action = mode === 'edit' ? data.endpoint : '/studio/categories';
  categoryDialog.querySelector('[data-category-title]').textContent = mode === 'edit' ? 'Редагувати категорію' : 'Нова категорія';
  categoryForm.querySelector('#categoryName').value = data.name || '';
  categoryForm.querySelector('#categoryCode').value = data.code || '';
  categoryForm.querySelector('#categoryDescription').value = data.description || '';
  openDialog(categoryDialog);
  categoryForm.querySelector('#categoryName').focus();
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-dialog="categoryDialog"]');
  if (opener) {
    openCategoryModal('create');
    return;
  }

  const edit = event.target.closest('[data-edit-category]');
  if (edit) {
    openCategoryModal('edit', {
      endpoint: edit.dataset.endpoint,
      name: edit.dataset.name,
      code: edit.dataset.code,
      description: edit.dataset.description
    });
  }
});

/* ── People ─────────────────────────────────────────────────────────────── */

const personDialog = document.getElementById('personDialog');
const personForm = personDialog?.querySelector('[data-person-form]');
const personPassword = personForm?.querySelector('#personPassword');
const personHint = personForm?.querySelector('[data-password-hint]');

function openPersonModal(mode, data = {}) {
  if (!personForm || !personDialog) return;
  clearFormErrors(personForm);
  personForm.reset();
  personForm.dataset.mode = mode;
  personForm.action = mode === 'edit' ? data.endpoint : '/studio/people';
  personDialog.querySelector('[data-person-title]').textContent = mode === 'edit' ? 'Редагувати людину' : 'Додати людину';
  personDialog.querySelector('[data-person-sub]').textContent =
    mode === 'edit'
      ? 'Залиште пароль порожнім, щоб не змінювати його.'
      : 'Пароль генерується тут або задається вручну. Людина зможе змінити його у профілі.';

  personForm.querySelector('#personName').value = data.name || '';
  personForm.querySelector('#personEmail').value = data.email || '';
  personForm.querySelector('#personRole').value = data.role || 'visitor';
  personForm.querySelector('#personInstitution').value = data.institution || '';
  personForm.querySelector('#personPhone').value = data.phone || '';
  personForm.querySelector('input[name="is_active"]').checked = mode === 'edit' ? data.active !== 'false' : true;

  if (personPassword) personPassword.value = '';
  if (personPassword) personPassword.type = 'password';
  if (personHint) {
    personHint.textContent =
      mode === 'edit'
        ? 'Залиште порожнім, щоб зберегти поточний пароль.'
        : 'Щонайменше 10 символів, одна літера та одна цифра.';
  }

  personForm.querySelectorAll('select[data-select]').forEach(refreshSelect);
  openDialog(personDialog);
  personForm.querySelector('#personName').focus();
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-dialog="personDialog"]');
  if (opener) {
    openPersonModal('create');
    return;
  }

  const edit = event.target.closest('[data-edit-person]');
  if (edit) {
    openPersonModal('edit', {
      endpoint: edit.dataset.endpoint,
      name: edit.dataset.name,
      email: edit.dataset.email,
      role: edit.dataset.role,
      institution: edit.dataset.institution,
      phone: edit.dataset.phone,
      active: edit.dataset.active
    });
  }
});

const generateButton = personDialog?.querySelector('[data-generate-password]');
generateButton?.addEventListener('click', () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_';
  const bytes = new Uint32Array(24);
  window.crypto.getRandomValues(bytes);
  let password = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  password = `${password.slice(0, 22)}A7`;
  if (personPassword) {
    personPassword.value = password;
    personPassword.type = 'text';
    personPassword.focus();
    personPassword.select();
  }
  if (personHint) personHint.textContent = 'Пароль згенеровано. Скопіюйте його зараз — після збереження він не показується.';
  showToast('Надійний пароль згенеровано. Скопіюйте його.');
});

/* ── Response drawer ────────────────────────────────────────────────────── */

const drawer = document.getElementById('responseDrawer');

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-open-response]');
  if (!trigger || !drawer) return;

  const content = drawer.querySelector('[data-drawer-content]');
  content.innerHTML = `<div class="empty-state" style="padding:48px 0;"><span class="empty-state__mark">${icon('inbox', 22)}</span><p>Завантажуємо відповіді…</p></div>`;
  openDialog(drawer);

  try {
    const response = await fetch(trigger.dataset.endpoint, {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' }
    });
    const data = await response.json();
    if (!response.ok || !data.html) throw new Error(data.message || 'failed');
    content.innerHTML = data.html;
  } catch {
    closeDialog(drawer);
    showToast('Не вдалося завантажити відповіді.', 'error');
  }
});

/* ── Auto-open create dialog ────────────────────────────────────────────── */

const params = new URLSearchParams(window.location.search);
if (params.get('new') === '1') {
  const dialog = document.getElementById('createSurveyDialog');
  if (dialog) {
    openDialog(dialog);
    params.delete('new');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }
}

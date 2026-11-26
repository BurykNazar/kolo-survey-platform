import { csrf, closeDialog, showToast } from './core.js';
import { applyFormErrors, clearFormErrors, replaceRegion, setLoading } from './form-utils.js';
import { refreshSelect } from './selects.js';

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

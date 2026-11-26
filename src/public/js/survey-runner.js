import { csrf, dismissToast, showToast } from './core.js';
import { setLoading } from './form-utils.js';

/* ── Survey runner ──────────────────────────────────────────────────────── */

const surveyForm = document.querySelector('[data-survey-form]');
if (surveyForm) {
  const questions = [...surveyForm.querySelectorAll('[data-question]')];
  const progress = document.querySelector('[data-runner-progress]');
  const draftEndpoint = surveyForm.dataset.draftEndpoint;
  const draftStatus = document.querySelector('[data-draft-status]');
  let draftTimer = null;
  let draftDirty = false;

  const draftBody = () => {
    const body = new URLSearchParams(new FormData(surveyForm));
    body.set('_csrf', csrf());
    return body;
  };

  const persistDraft = async () => {
    if (!draftEndpoint || !draftDirty) return;
    draftDirty = false;
    if (draftStatus) draftStatus.textContent = 'Зберігаємо…';
    try {
      const response = await fetch(draftEndpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' },
        body: draftBody()
      });
      const data = await response.json().catch(() => null);
      if (draftStatus) draftStatus.textContent = data?.ok ? 'Збережено' : 'Не вдалося зберегти';
      if (!data?.ok) draftDirty = true;
    } catch {
      if (draftStatus) draftStatus.textContent = 'Не вдалося зберегти';
      draftDirty = true;
    }
  };

  const scheduleDraft = () => {
    if (!draftEndpoint) return;
    draftDirty = true;
    if (draftStatus) draftStatus.textContent = 'Є незбережені зміни';
    clearTimeout(draftTimer);
    draftTimer = setTimeout(persistDraft, 600);
  };

  window.addEventListener('pagehide', () => {
    if (!draftEndpoint || !draftDirty) return;
    fetch(draftEndpoint, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' },
      body: draftBody(),
      keepalive: true
    }).catch(() => {});
  });

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
    scheduleDraft();
    const question = event.target.closest('[data-question]');
    if (question) question.classList.remove('is-invalid');
  });
  surveyForm.addEventListener('input', (event) => {
    updateProgress();
    scheduleDraft();
    const question = event.target.closest('[data-question]');
    if (question) question.classList.remove('is-invalid');
  });
  updateProgress();

  surveyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearTimeout(draftTimer);
    draftDirty = false;
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
        if (draftEndpoint) {
          draftDirty = true;
          scheduleDraft();
        }
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

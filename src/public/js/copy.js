import { openDialog, showToast } from './core.js';

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

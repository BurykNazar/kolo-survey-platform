import { closeDialog, openDialog, showToast } from './core.js';
import { postJson, setLoading } from './form-utils.js';

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

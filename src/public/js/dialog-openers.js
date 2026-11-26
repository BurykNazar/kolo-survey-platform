import { openDialog } from './core.js';
import { clearFormErrors } from './form-utils.js';
import { refreshSelect } from './selects.js';

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-dialog]');
  if (!opener) return;

  const dialog = document.getElementById(opener.dataset.openDialog);
  if (!dialog) return;

  const form = dialog.querySelector('form[data-reset-on-open]');
  if (form) {
    form.reset();
    form.querySelectorAll('select[data-select]').forEach(refreshSelect);
    clearFormErrors(form);
  }

  openDialog(dialog);
});

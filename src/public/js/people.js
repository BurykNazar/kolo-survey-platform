import { openDialog, showToast } from './core.js';
import { clearFormErrors } from './form-utils.js';
import { refreshSelect } from './selects.js';

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

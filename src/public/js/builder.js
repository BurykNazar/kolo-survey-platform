import { icon, openDialog, showToast } from './core.js';
import { clearFormErrors, postJson } from './form-utils.js';

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

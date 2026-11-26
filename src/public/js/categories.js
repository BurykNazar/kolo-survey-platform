import { openDialog, showToast } from './core.js';
import { clearFormErrors } from './form-utils.js';

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

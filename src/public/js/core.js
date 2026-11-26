/* Kolo — interactions */

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';


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
export { closeDialog, csrf, dismissToast, icon, openDialog, showToast };


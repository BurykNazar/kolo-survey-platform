import { openDialog } from './core.js';

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

/* ── Character counters ─────────────────────────────────────────────────── */

function updateCounter(input) {
  const counter = document.querySelector(`[data-count-for="${input.id}"]`);
  if (!counter) return;
  counter.textContent = `${input.value.length} / 2000`;
}

document.querySelectorAll('[data-counted]').forEach((input) => {
  updateCounter(input);
  input.addEventListener('input', () => updateCounter(input));
});

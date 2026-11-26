/* ── Filters & search ───────────────────────────────────────────────────── */

const catalogSearch = document.querySelector('[data-catalog-search]');
if (catalogSearch) {
  const cards = [...document.querySelectorAll('[data-card]')];
  const empty = document.querySelector('[data-catalog-empty]');

  const apply = () => {
    const query = catalogSearch.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const match = !query || card.dataset.search.includes(query);
      card.classList.toggle('is-hidden', !match);
      if (match) visible += 1;
    });
    if (empty) {
      if (cards.length === 0) {
        empty.classList.remove('is-hidden');
      } else {
        empty.classList.toggle('is-hidden', visible > 0);
        const text = empty.querySelector('[data-catalog-empty-text]');
        if (text && visible === 0) text.textContent = 'Спробуйте інший запит або оберіть іншу тему.';
      }
    }
  };

  catalogSearch.addEventListener('input', apply);
}

const listSearch = document.querySelector('[data-list-search]');
if (listSearch) {
  const selector = document.querySelector('[data-response-list]') ? '[data-attempt]' : '[data-survey-row]';
  const rows = [...document.querySelectorAll(selector)];
  listSearch.addEventListener('input', () => {
    const query = listSearch.value.trim().toLowerCase();
    rows.forEach((row) => {
      row.classList.toggle('is-hidden', Boolean(query) && !row.dataset.search.includes(query));
    });
  });
}

const responseFilter = document.querySelector('[data-response-filter]');
if (responseFilter) {
  responseFilter.addEventListener('change', () => {
    const value = responseFilter.value;
    const query = (document.querySelector('[data-list-search]')?.value || '').trim().toLowerCase();
    document.querySelectorAll('[data-attempt]').forEach((attempt) => {
      const surveyMatch = !value || attempt.dataset.surveyId === value;
      const searchMatch = !query || attempt.dataset.search.includes(query);
      attempt.classList.toggle('is-hidden', !surveyMatch || !searchMatch);
    });
  });
}

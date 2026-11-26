const MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
];

const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function firstName(name) {
  return String(name || '').split(/\s+/).filter(Boolean)[0] || '';
}

export function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShortDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

export function inputDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dotDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

export function relativeTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'щойно';
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} дн тому`;
  return formatShortDate(date);
}

// Українська плюралізація: 1 опитування, 2 опитування, 5 опитувань
export function plural(count, one, few, many) {
  const value = Math.abs(Number(count) || 0);
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function surveyWord(count) {
  return plural(count, 'опитування', 'опитування', 'опитувань');
}

export function responseWord(count) {
  return plural(count, 'відповідь', 'відповіді', 'відповідей');
}

export function participantWord(count) {
  return plural(count, 'учасник', 'учасники', 'учасників');
}

export function questionWord(count) {
  return plural(count, 'питання', 'питання', 'питань');
}

export function minuteWord(count) {
  return plural(count, 'хвилина', 'хвилини', 'хвилин');
}

export function truncate(value, length = 140) {
  const text = String(value || '').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function surveyTypeLabel(type) {
  const labels = {
    single_choice: 'Один варіант',
    multiple_choice: 'Кілька варіантів',
    text: 'Текст',
    rating: 'Шкала 1–10'
  };
  return labels[type] || type;
}

export function statusLabel(status) {
  const labels = { draft: 'Чернетка', active: 'Активне', closed: 'Завершене' };
  return labels[status] || status;
}

export function roleLabel(role) {
  const labels = { admin: 'Адміністратор', creator: 'Дослідник', visitor: 'Учасник' };
  return labels[role] || role;
}

export const helpers = {
  initials,
  firstName,
  formatDate,
  formatShortDate,
  formatDateTime,
  inputDate,
  dotDate,
  relativeTime,
  plural,
  surveyWord,
  responseWord,
  participantWord,
  questionWord,
  minuteWord,
  truncate,
  surveyTypeLabel,
  statusLabel,
  roleLabel
};

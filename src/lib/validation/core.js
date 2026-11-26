export const TYPES = ['single_choice', 'multiple_choice', 'text', 'rating'];
export const STATUSES = ['draft', 'active', 'closed'];

export function str(value, max = 5000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

export function passwordProblem(password) {
  const value = String(password || '');
  if (value.length < 10) return 'Пароль має містити щонайменше 10 символів.';
  if (value.length > 128) return 'Пароль не може бути довшим за 128 символів.';
  if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(value) || !/\d/.test(value)) {
    return 'Додайте до пароля хоча б одну літеру та одну цифру.';
  }
  return null;
}

export function safeReturnTo(value, fallback = '/studio') {
  const target = String(value || '');
  if (target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')) return target;
  return fallback;
}

export function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseDateInput(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getMonth() !== Number(match[2]) - 1) return null;
  return date;
}

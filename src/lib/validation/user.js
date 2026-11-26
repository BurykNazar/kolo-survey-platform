import { isEmail, passwordProblem, str } from './core.js';

export function validateUserInput(body, { requirePassword = false } = {}) {
  const errors = {};
  const fullName = str(body.full_name, 150);
  const email = str(body.email, 160).toLowerCase();
  const role = ['admin', 'creator', 'visitor'].includes(body.role) ? body.role : null;
  const institution = str(body.institution, 150);
  const phone = str(body.phone, 30);
  const password = String(body.password || '');

  if (fullName.length < 3) errors.full_name = 'Вкажіть ім’я (щонайменше 3 символи).';
  if (!isEmail(email)) errors.email = 'Вкажіть коректну електронну пошту.';
  if (!role) errors.role = 'Оберіть роль.';
  if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) errors.phone = 'Перевірте формат телефону.';

  if (requirePassword || password !== '') {
    const problem = passwordProblem(password);
    if (problem) errors.password = problem;
  }

  return {
    errors,
    data: { full_name: fullName, email, role, institution: institution || null, phone: phone || null, password }
  };
}

export function validateRegistration(body) {
  const errors = {};
  const fullName = str(body.full_name, 150);
  const email = str(body.email, 160).toLowerCase();
  const password = String(body.password || '');
  const institution = str(body.institution, 150);

  if (fullName.length < 3) errors.full_name = 'Вкажіть ім’я (щонайменше 3 символи).';
  if (!isEmail(email)) errors.email = 'Вкажіть коректну електронну пошту.';
  const problem = passwordProblem(password);
  if (problem) errors.password = problem;

  return { errors, data: { full_name: fullName, email, password, institution: institution || null } };
}

export function validateProfileInput(body) {
  const errors = {};
  const fullName = str(body.full_name, 150);
  const institution = str(body.institution, 150);
  const phone = str(body.phone, 30);

  if (fullName.length < 3) errors.full_name = 'Вкажіть ім’я (щонайменше 3 символи).';
  if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) errors.phone = 'Перевірте формат телефону.';

  return { errors, data: { full_name: fullName, institution: institution || null, phone: phone || null } };
}

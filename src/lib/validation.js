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

export function validateSurveyInput(body) {
  const errors = {};
  const title = str(body.title, 255);
  const description = str(body.description, 4000);
  const categoryId = parseId(body.category_id);
  const minutes = Number.parseInt(body.estimated_minutes, 10);
  const status = STATUSES.includes(body.status) ? body.status : null;
  let expiresAt = null;

  if (title.length < 5) errors.title = 'Назва має містити щонайменше 5 символів.';
  if (title.length > 160) errors.title = 'Скоротіть назву до 160 символів.';
  if (!categoryId) errors.category_id = 'Оберіть категорію.';
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    errors.estimated_minutes = 'Вкажіть час від 1 до 120 хвилин.';
  }
  if (!status) errors.status = 'Оберіть статус опитування.';

  if (body.expires_at && String(body.expires_at).trim() !== '') {
    expiresAt = parseDateInput(body.expires_at);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (!expiresAt) {
      errors.expires_at = 'Вкажіть коректну дату.';
    } else if (expiresAt.getTime() < todayStart.getTime() && status === 'active') {
      errors.expires_at = 'Дата завершення вже минула — оберіть майбутню.';
    }
  }

  return {
    errors,
    data: {
      title,
      description: description || null,
      category_id: categoryId,
      estimated_minutes: minutes,
      status,
      is_anonymous: body.is_anonymous === 'true' || body.is_anonymous === 'on' || body.is_anonymous === true,
      expires_at: expiresAt
    }
  };
}

export function validateQuestionInput(body) {
  const errors = {};
  const text = str(body.question_text, 1000);
  const type = TYPES.includes(body.question_type) ? body.question_type : null;
  const order = Number.parseInt(body.order_num, 10);
  const hint = str(body.hint, 255);
  const rawOptions = Array.isArray(body.options) ? body.options : [body.options];
  let options = rawOptions
    .flatMap((value) => String(value ?? '').split('\n'))
    .map((value) => value.trim().slice(0, 160))
    .filter(Boolean);

  options = [...new Set(options)];

  if (text.length < 5) errors.question_text = 'Сформулюйте питання (щонайменше 5 символів).';
  if (!type) errors.question_type = 'Оберіть тип питання.';
  if (body.order_num && (!Number.isInteger(order) || order < 1 || order > 999)) {
    errors.order_num = 'Порядковий номер має бути від 1 до 999.';
  }
  if ((type === 'single_choice' || type === 'multiple_choice') && options.length < 2) {
    errors.options = 'Додайте щонайменше два варіанти відповіді.';
  }
  if (options.length > 20) errors.options = 'Залиште не більше 20 варіантів.';

  return {
    errors,
    data: {
      question_text: text,
      question_type: type,
      order_num: Number.isInteger(order) && order > 0 ? order : 0,
      is_required: body.is_required === 'true' || body.is_required === 'on' || body.is_required === true,
      hint: hint || null,
      options,
      option_ids: (Array.isArray(body.option_ids) ? body.option_ids : [body.option_ids]).map((value) =>
        Number.parseInt(value, 10) || 0
      )
    }
  };
}

export function validateOptionInput(body) {
  const errors = {};
  const text = str(body.option_text, 255);
  const order = Number.parseInt(body.order_num, 10) || 1;
  if (!text) errors.option_text = 'Впишіть текст варіанта.';
  return { errors, data: { option_text: text, order_num: order } };
}

export function validateCategoryInput(body) {
  const errors = {};
  const name = str(body.name, 100);
  const code = str(body.code, 60)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  const description = str(body.description, 500);

  if (name.length < 3) errors.name = 'Назва має містити щонайменше 3 символи.';
  if (!code) errors.code = 'Додайте код латиницею: він потрібен для посилань.';
  if (code.length > 40) errors.code = 'Код має бути коротшим за 40 символів.';

  return { errors, data: { name, code, description: description || null } };
}

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

// Валідація відповідей на опитування. Повертає помилки за ключем q_<id>.
export function validateAnswers(questions, body) {
  const errors = {};
  const answers = [];

  for (const question of questions) {
    const key = `q_${question.id}`;
    const raw = body[key];
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    const provided = values.map((value) => String(value ?? '').trim()).filter(Boolean);
    const optionIds = new Set((question.options || []).map((option) => String(option.id)));

    if (question.question_type === 'text') {
      const text = provided.join(' ').trim();
      if (!text && question.is_required) {
        errors[key] = 'Напишіть відповідь на це питання.';
      } else if (text && text.length < 2) {
        errors[key] = 'Додайте хоча б кілька слів.';
      } else if (text.length > 2000) {
        errors[key] = 'Скоротіть відповідь до 2000 символів.';
      } else if (text) {
        answers.push({ question, text_answer: text });
      }
      continue;
    }

    if (question.question_type === 'rating') {
      if (provided.length === 0) {
        if (question.is_required) errors[key] = 'Оберіть оцінку від 1 до 10.';
        continue;
      }
      const rating = Number.parseInt(provided[0], 10);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
        errors[key] = 'Оцінка має бути числом від 1 до 10.';
      } else {
        answers.push({ question, rating_value: rating });
      }
      continue;
    }

    if (provided.length === 0) {
      if (question.is_required) {
        errors[key] = question.question_type === 'multiple_choice'
          ? 'Оберіть хоча б один варіант.'
          : 'Оберіть варіант відповіді.';
      }
      continue;
    }

    const invalid = provided.filter((value) => !optionIds.has(String(Number.parseInt(value, 10))));
    if (invalid.length > 0) {
      errors[key] = 'Обрано варіант, якого немає в цьому питанні.';
      continue;
    }

    if (question.question_type === 'single_choice' && provided.length > 1) {
      errors[key] = 'Для цього питання можна обрати лише один варіант.';
      continue;
    }

    const unique = [...new Set(provided.map((value) => Number.parseInt(value, 10)))];
    for (const optionId of unique) {
      answers.push({ question, option_id: optionId });
    }
  }

  return { errors, answers };
}

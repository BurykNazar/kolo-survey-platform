import { TYPES, str } from './core.js';

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

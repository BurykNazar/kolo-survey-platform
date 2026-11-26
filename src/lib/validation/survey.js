import { parseDateInput, parseId, STATUSES, str } from './core.js';

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

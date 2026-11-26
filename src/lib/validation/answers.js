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

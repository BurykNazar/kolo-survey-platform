import { AnswerOption, SurveyResult } from '../../db/models.js';
import { parseId } from '../../lib/validation.js';
import { apiData, apiError, questionAccess } from './shared.js';

export async function apiListOptions(req, res, next) {
  try {
    const where = req.query.question_id ? { question_id: parseId(req.query.question_id) } : {};
    const options = await AnswerOption.findAll({ where, order: [['question_id', 'ASC'], ['order_num', 'ASC']] });
    return apiData(res, options);
  } catch (error) {
    return next(error);
  }
}

export async function apiCreateOption(req, res, next) {
  try {
    const questionId = parseId(req.body.question_id);
    const { question, allowed } = await questionAccess(req.user, questionId);
    if (!question) return apiError(res, 404, 'Питання не знайдено.');
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');
    const text = String(req.body.option_text || '').trim().slice(0, 255);
    if (!text) return apiError(res, 422, 'Впишіть текст варіанта.', { option_text: 'Поле обов’язкове.' });

    const max = await AnswerOption.max('order_num', { where: { question_id: question.id } });
    const option = await AnswerOption.create({
      question_id: question.id,
      option_text: text,
      order_num: (Number(max) || 0) + 1
    });
    return apiData(res, option, 201);
  } catch (error) {
    return next(error);
  }
}

export async function apiUpdateOption(req, res, next) {
  try {
    const option = await AnswerOption.findByPk(req.params.id);
    if (!option) return apiError(res, 404, 'Варіант не знайдено.');
    const { allowed } = await questionAccess(req.user, option.question_id);
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');

    const text = String(req.body.option_text || '').trim().slice(0, 255);
    if (!text) return apiError(res, 422, 'Впишіть текст варіанта.');
    await option.update({ option_text: text, order_num: Number(req.body.order_num) || option.order_num });
    return apiData(res, option);
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteOption(req, res, next) {
  try {
    const option = await AnswerOption.findByPk(req.params.id);
    if (!option) return apiError(res, 404, 'Варіант не знайдено.');
    const { allowed } = await questionAccess(req.user, option.question_id);
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');
    await SurveyResult.destroy({ where: { option_id: option.id } });
    await option.destroy();
    return apiData(res, { removed: option.id });
  } catch (error) {
    return next(error);
  }
}

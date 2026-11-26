import { AnswerOption, Question, Survey } from '../../db/models.js';
import {
  canManageSurvey,
  deleteQuestionCascade,
  nextQuestionOrder,
  syncOptions
} from '../../services/surveys.js';
import { parseId, validateQuestionInput } from '../../lib/validation.js';
import { apiData, apiError, questionAccess } from './shared.js';

export async function apiListQuestions(req, res, next) {
  try {
    const where = req.query.survey_id ? { survey_id: parseId(req.query.survey_id) } : {};
    const questions = await Question.findAll({
      where,
      include: [{ model: AnswerOption, as: 'options' }],
      order: [['survey_id', 'ASC'], ['order_num', 'ASC']]
    });
    return apiData(res, questions);
  } catch (error) {
    return next(error);
  }
}

export async function apiCreateQuestion(req, res, next) {
  try {
    const surveyId = parseId(req.body.survey_id);
    const survey = surveyId ? await Survey.findByPk(surveyId) : null;
    if (!survey) return apiError(res, 404, 'Опитування не знайдено.');
    if (!canManageSurvey(req.user, survey)) return apiError(res, 403, 'Недостатньо прав.');

    const { errors, data } = validateQuestionInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);

    const question = await Question.create({
      survey_id: survey.id,
      question_text: data.question_text,
      question_type: data.question_type,
      order_num: data.order_num || (await nextQuestionOrder(survey.id)),
      is_required: data.is_required,
      hint: data.hint
    });
    if (['single_choice', 'multiple_choice'].includes(data.question_type) && data.options.length > 0) {
      await syncOptions(question.id, data.options, data.option_ids);
    }
    return apiData(res, await Question.findByPk(question.id, { include: [{ model: AnswerOption, as: 'options' }] }), 201);
  } catch (error) {
    return next(error);
  }
}

export async function apiUpdateQuestion(req, res, next) {
  try {
    const { question, survey, allowed } = await questionAccess(req.user, req.params.id);
    if (!question) return apiError(res, 404, 'Питання не знайдено.');
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');

    const { errors, data } = validateQuestionInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);

    await question.update({
      question_text: data.question_text,
      question_type: data.question_type,
      order_num: data.order_num || question.order_num,
      is_required: data.is_required,
      hint: data.hint
    });
    if (['single_choice', 'multiple_choice'].includes(data.question_type)) {
      await syncOptions(question.id, data.options, data.option_ids);
    } else {
      await syncOptions(question.id, []);
    }
    return apiData(res, await Question.findByPk(question.id, { include: [{ model: AnswerOption, as: 'options' }] }));
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteQuestion(req, res, next) {
  try {
    const { question, allowed } = await questionAccess(req.user, req.params.id);
    if (!question) return apiError(res, 404, 'Питання не знайдено.');
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');
    await deleteQuestionCascade(question.id);
    return apiData(res, { removed: question.id });
  } catch (error) {
    return next(error);
  }
}

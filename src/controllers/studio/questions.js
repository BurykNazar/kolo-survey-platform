import { Op } from 'sequelize';
import { Question } from '../../db/models.js';
import {
  deleteQuestionCascade,
  loadSurveyBundle,
  nextQuestionOrder,
  reorderQuestions,
  syncOptions
} from '../../services/surveys.js';
import { validateQuestionInput } from '../../lib/validation.js';
import {
  canManageSurveyById,
  deny,
  done,
  questionPayload,
  reject,
  renderHtml
} from './shared.js';

// ── Питання ──────────────────────────────────────────────────────────────────

async function questionsRegion(res, surveyId) {
  const survey = await loadSurveyBundle(surveyId);
  return renderHtml(res, 'partials/questions-region.njk', {
    survey,
    questionData: questionPayload(survey.questions),
    canManage: true
  });
}

export async function createQuestion(req, res, next) {
  try {
    const survey = await canManageSurveyById(req.user, req.params.id);
    if (!survey) return deny(req, res);

    const { errors, data } = validateQuestionInput(req.body);
    if (Object.keys(errors).length > 0) {
      return reject(req, res, 422, 'Перевірте питання.', errors);
    }

    const question = await Question.create({
      survey_id: survey.id,
      question_text: data.question_text,
      question_type: data.question_type,
      order_num: await nextQuestionOrder(survey.id),
      is_required: data.is_required,
      hint: data.hint
    });
    if (data.options.length > 0) await syncOptions(question.id, data.options, data.option_ids);

    const html = await questionsRegion(res, survey.id);
    return done(req, res, { message: 'Питання додано.', html, questionId: question.id });
  } catch (error) {
    return next(error);
  }
}

export async function updateQuestion(req, res, next) {
  try {
    const question = await Question.findByPk(req.params.id);
    if (!question) return reject(req, res, 404, 'Питання не знайдено.');
    const survey = await canManageSurveyById(req.user, question.survey_id);
    if (!survey) return deny(req, res);

    const { errors, data } = validateQuestionInput(req.body);
    if (Object.keys(errors).length > 0) {
      return reject(req, res, 422, 'Перевірте питання.', errors);
    }

    await question.update({
      question_text: data.question_text,
      question_type: data.question_type,
      is_required: data.is_required,
      hint: data.hint,
      order_num: data.order_num || question.order_num
    });
    if (['single_choice', 'multiple_choice'].includes(data.question_type)) {
      await syncOptions(question.id, data.options, data.option_ids);
    } else {
      await syncOptions(question.id, []);
    }
    await reorderQuestions(survey.id);

    const html = await questionsRegion(res, survey.id);
    return done(req, res, { message: 'Питання оновлено.', html });
  } catch (error) {
    return next(error);
  }
}

export async function removeQuestion(req, res, next) {
  try {
    const question = await Question.findByPk(req.params.id);
    if (!question) return reject(req, res, 404, 'Питання не знайдено.');
    const survey = await canManageSurveyById(req.user, question.survey_id);
    if (!survey) return deny(req, res);

    await deleteQuestionCascade(question.id);
    await reorderQuestions(survey.id);

    const html = await questionsRegion(res, survey.id);
    return done(req, res, { message: 'Питання видалено.', html });
  } catch (error) {
    return next(error);
  }
}

export async function moveQuestion(req, res, next) {
  try {
    const question = await Question.findByPk(req.params.id);
    if (!question) return reject(req, res, 404, 'Питання не знайдено.');
    const survey = await canManageSurveyById(req.user, question.survey_id);
    if (!survey) return deny(req, res);

    const direction = req.body.direction === 'up' ? 'up' : 'down';
    const neighbourWhere =
      direction === 'up'
        ? { survey_id: survey.id, order_num: { [Op.lt]: question.order_num } }
        : { survey_id: survey.id, order_num: { [Op.gt]: question.order_num } };

    const neighbour = await Question.findOne({
      where: neighbourWhere,
      order: [['order_num', direction === 'up' ? 'DESC' : 'ASC']]
    });

    if (neighbour) {
      const currentOrder = question.order_num;
      await question.update({ order_num: neighbour.order_num });
      await neighbour.update({ order_num: currentOrder });
    }

    const html = await questionsRegion(res, survey.id);
    return done(req, res, { message: 'Порядок оновлено.', html });
  } catch (error) {
    return next(error);
  }
}

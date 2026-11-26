import { Survey, SurveyCategory, Question, AnswerOption, SurveyResult } from '../db/models.js';
import { activeSurveyWhere } from '../services/surveys.js';
import { safeReturnTo } from '../lib/validation.js';

export async function authShowcase() {
  const surveys = await Survey.findAll({
    where: activeSurveyWhere(),
    include: [
      { model: SurveyCategory, as: 'category' },
      { model: Question, as: 'questions', include: [{ model: AnswerOption, as: 'options' }] }
    ],
    order: [['id', 'ASC']]
  });
  if (surveys.length === 0) return null;

  const withChoice = surveys.filter((survey) =>
    (survey.questions || []).some((question) => question.question_type === 'single_choice')
  );
  const pool = withChoice.length > 0 ? withChoice : surveys;
  const survey = pool[Math.floor(Math.random() * pool.length)];

  const attempts = await SurveyResult.count({
    where: { survey_id: survey.id },
    distinct: true,
    col: 'session_id'
  });
  const questions = [...(survey.questions || [])].sort((a, b) => a.order_num - b.order_num);
  const question = questions.find((item) => item.question_type === 'single_choice') || questions[0] || null;

  return { survey, question, attempts };
}

export function loginData(req) {
  return {
    title: 'Вхід — Kolo',
    returnTo: safeReturnTo(req.query.returnTo || req.body?.returnTo, '/studio'),
    errors: {},
    values: {}
  };
}

export function respondLogin(req, res, { status = 200, errors = {}, values = {}, message = '', redirect = '' } = {}) {
  if (req.wantsJson) {
    return res.status(status).json({ ok: Object.keys(errors).length === 0, errors, message, redirect });
  }
  return res.status(status).render('pages/auth-login.njk', {
    title: 'Вхід — Kolo',
    returnTo: safeReturnTo(req.body?.returnTo, '/studio'),
    errors,
    values,
    message
  });
}

export function respondRegister(req, res, { status = 200, errors = {}, values = {}, message = '', redirect = '' } = {}) {
  if (req.wantsJson) {
    return res.status(status).json({ ok: Object.keys(errors).length === 0, errors, message, redirect });
  }
  return res.status(status).render('pages/auth-register.njk', {
    title: 'Реєстрація — Kolo',
    errors,
    values,
    message
  });
}

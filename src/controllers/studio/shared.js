import {
  Survey,
  SurveyCategory,
  Question,
  SurveyResult,
  User
} from '../../db/models.js';
import { canManageSurvey } from '../../services/surveys.js';

export function renderHtml(res, view, data) {
  return new Promise((resolve, reject) => {
    res.render(view, data, (error, html) => (error ? reject(error) : resolve(html)));
  });
}

export function deny(req, res, message = 'Для цієї дії бракує прав.') {
  if (req.wantsJson) return res.status(403).json({ ok: false, message });
  return res.status(403).render('pages/error.njk', {
    status: 403,
    title: 'Доступ обмежено',
    message
  });
}

export function reject(req, res, status, message, errors = {}) {
  if (req.wantsJson) return res.status(status).json({ ok: false, message, errors });
  return res.redirect(`${req.path}?err=${encodeURIComponent(message)}`);
}

export function done(req, res, payload = {}) {
  if (req.wantsJson) return res.json({ ok: true, ...payload });
  return res.redirect(payload.redirect || req.originalUrl);
}

export function surveyCountsById(surveys, attemptsMap) {
  const counts = {};
  for (const survey of surveys) counts[survey.id] = attemptsMap.get(survey.id) || 0;
  return counts;
}

export function questionPayload(questions) {
  const map = {};
  for (const question of questions || []) {
    map[question.id] = {
      id: question.id,
      text: question.question_text,
      type: question.question_type,
      hint: question.hint || '',
      required: Boolean(question.is_required),
      options: (question.options || []).map((option) => ({ id: option.id, text: option.option_text }))
    };
  }
  return map;
}

export async function surveysForUser(user) {
  const where = user.role === 'creator' ? { creator_id: user.id } : {};
  return Survey.findAll({
    where,
    include: [
      { model: SurveyCategory, as: 'category' },
      { model: User, as: 'creator', attributes: ['id', 'full_name'] },
      { model: Question, as: 'questions', attributes: ['id'] }
    ],
    order: [['created_at', 'DESC']]
  });
}

export async function canManageSurveyById(user, surveyId) {
  const survey = await Survey.findByPk(surveyId);
  if (!survey) return null;
  return canManageSurvey(user, survey) ? survey : null;
}

async function scopedSurveyIds(user) {
  if (user.role === 'admin') {
    const rows = await Survey.findAll({ attributes: ['id'], raw: true });
    return rows.map((row) => row.id);
  }
  const rows = await Survey.findAll({ where: { creator_id: user.id }, attributes: ['id'], raw: true });
  return rows.map((row) => row.id);
}

export async function viewerSurveyIds(user) {
  if (user.role === 'visitor') {
    const rows = await SurveyResult.findAll({ where: { user_id: user.id }, attributes: ['survey_id'], raw: true });
    return [...new Set(rows.map((row) => row.survey_id))];
  }
  return scopedSurveyIds(user);
}

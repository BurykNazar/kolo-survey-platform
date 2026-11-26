import { Question, Survey } from '../../db/models.js';
import { canManageSurvey } from '../../services/surveys.js';

export function apiError(res, status, message, errors) {
  return res.status(status).json({ ok: false, message, ...(errors ? { errors } : {}) });
}

export function apiData(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export async function questionAccess(user, questionId) {
  const question = await Question.findByPk(questionId);
  if (!question) return { question: null };
  const survey = await Survey.findByPk(question.survey_id);
  return { question, survey, allowed: canManageSurvey(user, survey) };
}

import { SurveyResult } from '../db/models.js';
import { canManageSurvey, isOpen, loadSurveyBundle } from '../services/surveys.js';

export function renderView(res, view, data) {
  return new Promise((resolve, reject) => {
    res.render(view, data, (error, html) => (error ? reject(error) : resolve(html)));
  });
}

export async function renderSurveyPage(req, res, { status = 200, errors = {}, values = {}, message = '' } = {}) {
  const survey = await loadSurveyBundle(req.params.id);
  if (!survey) {
    return res.status(404).render('pages/error.njk', {
      status: 404,
      title: 'Опитування не знайдено',
      message: 'Можливо, автор його видалив або посилання змінилося.'
    });
  }

  const manager = canManageSurvey(req.user, survey);
  const open = isOpen(survey);
  if (!open && !manager) {
    return res.status(410).render('pages/survey-closed.njk', {
      title: `${survey.title} — опитування завершено`,
      survey
    });
  }

  const attempts = await SurveyResult.count({
    where: { survey_id: survey.id },
    distinct: true,
    col: 'session_id'
  });

  const totalQuestions = survey.questions.length;
  const answered = survey.questions.filter((question) => question.is_required).length;

  return res.status(status).render('pages/survey.njk', {
    title: `${survey.title} — Kolo`,
    description: survey.description,
    survey,
    open,
    preview: !open && manager,
    attempts,
    totalQuestions,
    requiredCount: answered,
    errors,
    values,
    message
  });
}

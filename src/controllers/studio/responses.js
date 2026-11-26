import { Op } from 'sequelize';
import { Survey, SurveyResult } from '../../db/models.js';
import { canManageSurvey } from '../../services/surveys.js';
import { attemptList, attemptStats } from '../../services/answers.js';
import { parseId } from '../../lib/validation.js';
import {
  deny,
  done,
  reject,
  renderHtml,
  viewerSurveyIds
} from './shared.js';

// ── Відповіді ────────────────────────────────────────────────────────────────

export async function getResponses(req, res, next) {
  try {
    const surveyIds = await viewerSurveyIds(req.user);
    const attempts = await attemptList({
      surveyIds,
      userId: req.user.role === 'visitor' ? req.user.id : null
    });
    const stats = await attemptStats(surveyIds);
    const surveys = await Survey.findAll({
      where: { id: { [Op.in]: surveyIds.length ? surveyIds : [0] } },
      attributes: ['id', 'title'],
      order: [['title', 'ASC']],
      raw: true
    });

    return res.render('pages/responses.njk', {
      title: 'Відповіді — Kolo',
      attempts,
      stats,
      surveys,
      mode: req.user.role
    });
  } catch (error) {
    return next(error);
  }
}

export async function getResponseDetail(req, res, next) {
  try {
    const surveyId = parseId(req.params.surveyId);
    const sessionId = String(req.params.sessionId || '');
    const survey = surveyId ? await Survey.findByPk(surveyId) : null;
    if (!survey) return res.status(404).send('');

    const allowed =
      req.user.role === 'admin' ||
      (req.user.role === 'creator' && Number(survey.creator_id) === Number(req.user.id)) ||
      req.user.role === 'visitor';

    if (!allowed) return res.status(403).send('');

    const attempts = await attemptList({ surveyId: survey.id, sessionId });
    const attempt = attempts[0];
    if (!attempt) return res.status(404).send('');

    if (req.user.role === 'visitor') {
      const mine = await SurveyResult.findOne({
        where: { survey_id: survey.id, session_id: sessionId, user_id: req.user.id }
      });
      if (!mine) return res.status(403).send('');
    }

    const html = await renderHtml(res, 'partials/response-detail.njk', { attempt, survey });
    return res.json({ ok: true, html });
  } catch (error) {
    return next(error);
  }
}

export async function removeResponse(req, res, next) {
  try {
    const surveyId = parseId(req.body.survey_id);
    const sessionId = String(req.body.session_id || '');
    if (!surveyId || !sessionId) return reject(req, res, 422, 'Не вдалося визначити відповідь.');

    const survey = await Survey.findByPk(surveyId);
    if (!survey) return reject(req, res, 404, 'Опитування не знайдено.');
    if (!canManageSurvey(req.user, survey)) return deny(req, res);

    const removed = await SurveyResult.destroy({ where: { survey_id: surveyId, session_id: sessionId } });
    return done(req, res, { message: `Видалено ${removed} записів відповідей.`, removed });
  } catch (error) {
    return next(error);
  }
}

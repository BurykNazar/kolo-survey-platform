import { Op } from 'sequelize';
import { Survey, SurveyCategory } from '../../db/models.js';
import { attemptsBySurvey, isOpen } from '../../services/surveys.js';
import {
  adminBreakdown,
  attemptsPerSurvey,
  dailyAttempts,
  platformCounts,
  recentActivity,
  totalsFor,
  visitorOverview
} from '../../services/stats.js';
import { surveyCountsById, surveysForUser } from './shared.js';

// ── Огляд ────────────────────────────────────────────────────────────────────

export async function getOverview(req, res, next) {
  try {
    const user = req.user;

    if (user.role === 'visitor') {
      const overview = await visitorOverview(user);
      const activeSurveys = await Survey.findAll({
        where: { status: 'active', [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }] },
        include: [{ model: SurveyCategory, as: 'category' }],
        order: [['created_at', 'DESC']],
        limit: 4
      });
      const attemptsMap = await attemptsBySurvey(activeSurveys.map((survey) => survey.id));

      return res.render('pages/overview.njk', {
        title: 'Ваш огляд — Kolo',
        mode: 'visitor',
        overview,
        activeSurveys,
        counts: surveyCountsById(activeSurveys, attemptsMap),
        forcedPassword: false
      });
    }

    const surveys = await surveysForUser(user);
    const ids = surveys.map((survey) => survey.id);
    const [attemptsMap, totals, daily, perSurvey, activity] = await Promise.all([
      attemptsBySurvey(ids),
      totalsFor(ids),
      dailyAttempts(ids),
      attemptsPerSurvey(ids),
      recentActivity(ids)
    ]);

    const counts = surveyCountsById(surveys, attemptsMap);
    const perSurveyWithTitles = perSurvey.map((row) => ({
      ...row,
      title: surveys.find((survey) => survey.id === row.surveyId)?.title || 'Опитування'
    }));

    const dailyMax = Math.max(1, ...daily.map((day) => day.count));
    const chartTotal = perSurveyWithTitles.reduce((sum, row) => sum + row.attempts, 0) || 1;

    const platform = user.role === 'admin' ? await platformCounts() : null;
    const creators = user.role === 'admin' ? await adminBreakdown() : null;

    return res.render('pages/overview.njk', {
      title: 'Огляд — Kolo',
      mode: user.role,
      surveys: surveys.slice(0, 5),
      surveyTotal: surveys.length,
      counts,
      totals,
      daily,
      dailyMax,
      perSurvey: perSurveyWithTitles,
      chartTotal,
      activity,
      platform,
      creators,
      activeCount: surveys.filter((survey) => isOpen(survey)).length,
      forcedPassword: Boolean(req.query.first)
    });
  } catch (error) {
    return next(error);
  }
}

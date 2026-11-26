import { Op, QueryTypes } from 'sequelize';
import { sequelize, Survey, SurveyCategory, SurveyResult, User } from '../db/models.js';

export async function scopedSurveyIds(user) {
  if (!user) return [];
  const where = user.role === 'creator' ? { creator_id: user.id } : {};
  const rows = await Survey.findAll({ where, attributes: ['id'], raw: true });
  return rows.map((row) => row.id);
}

export async function totalsFor(surveyIds) {
  if (!surveyIds || surveyIds.length === 0) {
    return { attempts: 0, answers: 0, participants: 0, last7: 0 };
  }

  const [row] = await sequelize.query(
    `SELECT COUNT(DISTINCT session_id)::int AS attempts,
            COUNT(*)::int AS answers,
            COUNT(DISTINCT COALESCE(user_id::text, session_id))::int AS participants,
            COUNT(DISTINCT session_id) FILTER (WHERE answered_at > NOW() - INTERVAL '7 days')::int AS last7
       FROM survey_results
      WHERE survey_id IN (:ids)`,
    { replacements: { ids: surveyIds }, type: QueryTypes.SELECT }
  );

  return {
    attempts: Number(row?.attempts || 0),
    answers: Number(row?.answers || 0),
    participants: Number(row?.participants || 0),
    last7: Number(row?.last7 || 0)
  };
}

export async function dailyAttempts(surveyIds, days = 7) {
  const empty = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    empty.push({ date: date.toISOString().slice(0, 10), count: 0 });
  }
  if (!surveyIds || surveyIds.length === 0) return empty;

  const span = Math.max(1, Math.min(30, Number(days) || 7));
  const rows = await sequelize.query(
    `SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date, COUNT(DISTINCT r.session_id)::int AS count
       FROM generate_series(CURRENT_DATE - (${span - 1}) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') AS d(day)
       LEFT JOIN survey_results r
         ON r.survey_id IN (:ids)
        AND r.answered_at >= d.day
        AND r.answered_at < d.day + INTERVAL '1 day'
      GROUP BY d.day
      ORDER BY d.day ASC`,
    { replacements: { ids: surveyIds }, type: QueryTypes.SELECT }
  );

  return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
}

export async function recentActivity(surveyIds, limit = 6) {
  if (!surveyIds || surveyIds.length === 0) return [];

  const rows = await SurveyResult.findAll({
    where: { survey_id: { [Op.in]: surveyIds } },
    include: [
      { model: Survey, as: 'survey', attributes: ['id', 'title', 'is_anonymous'] },
      { model: User, as: 'respondent', attributes: ['id', 'full_name'] }
    ],
    order: [['answered_at', 'DESC'], ['id', 'DESC']],
    limit: limit * 6
  });

  const seen = new Set();
  const activity = [];
  for (const row of rows) {
    const key = `${row.survey_id}:${row.session_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    activity.push({
      surveyId: row.survey_id,
      surveyTitle: row.survey?.title || 'Опитування',
      anonymous: row.is_anonymous || !row.user_id,
      name: row.is_anonymous || !row.user_id ? 'Анонімний учасник' : row.respondent?.full_name || 'Учасник',
      answeredAt: row.answered_at
    });
    if (activity.length >= limit) break;
  }
  return activity;
}

export async function attemptsPerSurvey(surveyIds) {
  if (!surveyIds || surveyIds.length === 0) return [];
  const rows = await sequelize.query(
    `SELECT r.survey_id, COUNT(DISTINCT r.session_id)::int AS attempts
       FROM survey_results r
      WHERE r.survey_id IN (:ids)
      GROUP BY r.survey_id
      ORDER BY attempts DESC
      LIMIT 5`,
    { replacements: { ids: surveyIds }, type: QueryTypes.SELECT }
  );
  return rows.map((row) => ({ surveyId: Number(row.survey_id), attempts: Number(row.attempts) }));
}

export async function visitorOverview(user) {
  const responses = await SurveyResult.findAll({
    where: { user_id: user.id },
    include: [{ model: Survey, as: 'survey', attributes: ['id', 'title', 'status'] }],
    order: [['answered_at', 'DESC']]
  });

  const attempts = new Map();
  for (const row of responses) {
    const key = `${row.survey_id}:${row.session_id}`;
    if (!attempts.has(key)) {
      attempts.set(key, {
        surveyId: row.survey_id,
        surveyTitle: row.survey?.title || 'Опитування',
        answeredAt: row.answered_at,
        answers: 0
      });
    }
    attempts.get(key).answers += 1;
  }

  return {
    attempts: [...attempts.values()],
    responseCount: responses.length
  };
}

export async function platformCounts() {
  const [row] = await sequelize.query(
    `SELECT
       (SELECT COUNT(*)::int FROM surveys) AS surveys,
       (SELECT COUNT(*)::int FROM app_users) AS users,
       (SELECT COUNT(*)::int FROM app_users WHERE role = 'creator') AS creators,
       (SELECT COUNT(*)::int FROM survey_categories) AS categories,
       (SELECT COUNT(DISTINCT session_id)::int FROM survey_results) AS attempts`,
    { type: QueryTypes.SELECT }
  );
  return row;
}

export async function adminBreakdown() {
  const rows = await sequelize.query(
    `SELECT u.id, u.full_name, COUNT(s.id)::int AS surveys
       FROM app_users u
       LEFT JOIN surveys s ON s.creator_id = u.id
      WHERE u.role = 'creator'
      GROUP BY u.id
      ORDER BY surveys DESC, u.full_name ASC`,
    { type: QueryTypes.SELECT }
  );
  return rows;
}

export async function studioCounters(user) {
  const where = user.role === 'creator' ? { creator_id: user.id } : {};
  const [surveys, active, categories] = await Promise.all([
    Survey.count({ where }),
    Survey.count({ where: { ...where, status: 'active' } }),
    SurveyCategory.count()
  ]);
  return { surveys, active, categories };
}

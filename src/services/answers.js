import { Op } from 'sequelize';
import { Survey, SurveyResult, Question, AnswerOption, User } from '../db/models.js';

function describeAnswer(row) {
  if (row.option_id) return row.chosenOption?.option_text || 'Варіант видалено';
  if (row.rating_value !== null && row.rating_value !== undefined) return `${row.rating_value} / 10`;
  if (row.text_answer) return row.text_answer;
  return '—';
}

export async function attemptList({ surveyIds = null, surveyId = null, sessionId = null, userId = null, limit = 400 } = {}) {
  const where = {};
  if (surveyId) where.survey_id = surveyId;
  if (surveyIds) where.survey_id = { [Op.in]: surveyIds };
  if (sessionId) where.session_id = sessionId;
  if (userId) where.user_id = userId;

  const rows = await SurveyResult.findAll({
    where,
    include: [
      { model: Survey, as: 'survey', attributes: ['id', 'title', 'is_anonymous'] },
      { model: Question, as: 'question', attributes: ['id', 'question_text', 'question_type', 'order_num'] },
      { model: AnswerOption, as: 'chosenOption', attributes: ['id', 'option_text'] },
      { model: User, as: 'respondent', attributes: ['id', 'full_name', 'email', 'institution'] }
    ],
    order: [['answered_at', 'DESC'], ['id', 'ASC']],
    limit
  });

  const map = new Map();

  for (const row of rows) {
    const key = `${row.survey_id}:${row.session_id}`;
    if (!map.has(key)) {
      const anonymous = Boolean(row.is_anonymous || !row.user_id);
      map.set(key, {
        key,
        surveyId: row.survey_id,
        surveyTitle: row.survey?.title || `Опитування #${row.survey_id}`,
        sessionId: row.session_id,
        anonymous,
        name: anonymous ? 'Анонімний учасник' : row.respondent?.full_name || 'Учасник',
        email: anonymous ? '' : row.respondent?.email || '',
        institution: anonymous ? '' : row.respondent?.institution || '',
        answeredAt: row.answered_at,
        answers: []
      });
    }

    const attempt = map.get(key);
    const question = row.question;
    let answer = attempt.answers.find((entry) => entry.questionId === row.question_id);
    if (!answer) {
      answer = {
        questionId: row.question_id,
        text: question?.question_text || `Питання #${row.question_id}`,
        type: question?.question_type || 'text',
        order: question?.order_num || 0,
        values: []
      };
      attempt.answers.push(answer);
    }

    const value = describeAnswer(row);
    if (!answer.values.includes(value)) answer.values.push(value);
  }

  const attempts = [...map.values()];
  for (const attempt of attempts) {
    attempt.answers.sort((a, b) => a.order - b.order);
    attempt.answersCount = attempt.answers.length;
  }

  attempts.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
  return attempts;
}

export async function attemptStats(surveyIds) {
  if (!surveyIds || surveyIds.length === 0) {
    return { total: 0, anonymous: 0, week: 0, averageAnswers: 0 };
  }
  const rows = await SurveyResult.findAll({
    where: { survey_id: { [Op.in]: surveyIds } },
    attributes: ['survey_id', 'session_id', 'is_anonymous', 'answered_at'],
    raw: true
  });

  const sessions = new Map();
  for (const row of rows) {
    const key = `${row.survey_id}:${row.session_id}`;
    if (!sessions.has(key)) {
      sessions.set(key, {
        anonymous: row.is_anonymous,
        answeredAt: new Date(row.answered_at).getTime(),
        answers: 0
      });
    }
    sessions.get(key).answers += 1;
  }

  const list = [...sessions.values()];
  const weekAgo = Date.now() - 7 * 86400000;
  const total = list.length;
  const anonymous = list.filter((entry) => entry.anonymous).length;
  const week = list.filter((entry) => entry.answeredAt >= weekAgo).length;
  const averageAnswers = total ? Math.round(list.reduce((sum, entry) => sum + entry.answers, 0) / total) : 0;

  return { total, anonymous, week, averageAnswers };
}

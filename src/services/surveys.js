import { Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  Survey,
  SurveyCategory,
  Question,
  AnswerOption,
  SurveyResult,
  User
} from '../db/models.js';
import { deleteDraftsForSurvey } from './drafts.js';

export const activeSurveyWhere = () => ({
  status: 'active',
  [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
});

export function isExpired(survey) {
  return Boolean(survey?.expires_at && new Date(survey.expires_at).getTime() < Date.now());
}

export function isOpen(survey) {
  return survey?.status === 'active' && !isExpired(survey);
}

export function canManageSurvey(user, survey) {
  if (!user || !survey) return false;
  if (user.role === 'admin') return true;
  return user.role === 'creator' && Number(survey.creator_id) === Number(user.id);
}

export function studioSurveyWhere(user, extra = {}) {
  const where = { ...extra };
  if (!user || user.role === 'visitor') return null;
  if (user.role === 'creator') where.creator_id = user.id;
  return where;
}

export async function loadSurveyBundle(id) {
  return Survey.findByPk(id, {
    include: [
      { model: SurveyCategory, as: 'category' },
      { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
      {
        model: Question,
        as: 'questions',
        include: [{ model: AnswerOption, as: 'options' }]
      }
    ],
    order: [
      [{ model: Question, as: 'questions' }, 'order_num', 'ASC'],
      [{ model: Question, as: 'questions' }, { model: AnswerOption, as: 'options' }, 'order_num', 'ASC']
    ]
  });
}

export async function loadSurveyList({ user, status, categoryCode, search } = {}) {
  const where = {};

  if (user?.role === 'creator') {
    where.creator_id = user.id;
  } else if (!user || user.role === 'visitor') {
    Object.assign(where, activeSurveyWhere());
  }

  if (status && ['draft', 'active', 'closed'].includes(status)) where.status = status;
  if (search) {
    where.title = { [Op.iLike]: `%${search}%` };
  }

  const includeCategory = { model: SurveyCategory, as: 'category' };
  if (categoryCode) {
    includeCategory.where = { code: categoryCode };
    includeCategory.required = true;
  }

  return Survey.findAll({
    where,
    include: [
      includeCategory,
      { model: User, as: 'creator', attributes: ['id', 'full_name'] }
    ],
    order: [['created_at', 'DESC']]
  });
}

export async function attemptsBySurvey(surveyIds) {
  const map = new Map();
  if (!surveyIds || surveyIds.length === 0) return map;
  const rows = await sequelize.query(
    `SELECT survey_id, COUNT(DISTINCT session_id)::int AS attempts
       FROM survey_results
      WHERE survey_id IN (:ids)
      GROUP BY survey_id`,
    { replacements: { ids: surveyIds }, type: QueryTypes.SELECT }
  );
  for (const row of rows) map.set(Number(row.survey_id), Number(row.attempts));
  return map;
}

export async function categoryCounts() {
  const rows = await sequelize.query(
    `SELECT c.id, c.code, c.name, c.description,
            COUNT(s.id) FILTER (WHERE s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW()))::int AS active_surveys
       FROM survey_categories c
       LEFT JOIN surveys s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC`,
    { type: QueryTypes.SELECT }
  );
  return rows;
}

export async function nextQuestionOrder(surveyId) {
  const max = await Question.max('order_num', { where: { survey_id: surveyId } });
  return (Number(max) || 0) + 1;
}

export async function reorderQuestions(surveyId) {
  const questions = await Question.findAll({
    where: { survey_id: surveyId },
    order: [['order_num', 'ASC'], ['id', 'ASC']]
  });
  let index = 1;
  for (const question of questions) {
    if (question.order_num !== index) {
      await question.update({ order_num: index });
    }
    index += 1;
  }
}

export async function syncOptions(questionId, labels, ids = []) {
  const existing = await AnswerOption.findAll({
    where: { question_id: questionId },
    order: [['order_num', 'ASC'], ['id', 'ASC']]
  });

  const used = [];
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const requestedId = Number.parseInt(ids[index], 10);
    const match = existing.find(
      (option) => !used.includes(option.id) && (option.id === requestedId || (!requestedId && option.option_text === label))
    );

    if (match) {
      used.push(match.id);
      if (match.option_text !== label || match.order_num !== index + 1) {
        await match.update({ option_text: label, order_num: index + 1 });
      }
    } else {
      const created = await AnswerOption.create({
        question_id: questionId,
        option_text: label,
        order_num: index + 1
      });
      used.push(created.id);
    }
  }

  const keep = new Set(used);
  const orphaned = existing.filter((option) => !keep.has(option.id));
  if (orphaned.length > 0) {
    const ids = orphaned.map((option) => option.id);
    await SurveyResult.destroy({ where: { option_id: { [Op.in]: ids } } });
    await AnswerOption.destroy({ where: { id: { [Op.in]: ids } } });
  }
}

export async function deleteSurveyCascade(surveyId) {
  await deleteDraftsForSurvey(surveyId);
  const questions = await Question.findAll({
    where: { survey_id: surveyId },
    attributes: ['id'],
    raw: true
  });
  const questionIds = questions.map((row) => row.id);
  if (questionIds.length > 0) {
    await SurveyResult.destroy({ where: { question_id: { [Op.in]: questionIds } } });
    await AnswerOption.destroy({ where: { question_id: { [Op.in]: questionIds } } });
    await Question.destroy({ where: { id: { [Op.in]: questionIds } } });
  }
  await SurveyResult.destroy({ where: { survey_id: surveyId } });
  await Survey.destroy({ where: { id: surveyId } });
}

export async function deleteQuestionCascade(questionId) {
  await SurveyResult.destroy({ where: { question_id: questionId } });
  await AnswerOption.destroy({ where: { question_id: questionId } });
  await Question.destroy({ where: { id: questionId } });
}

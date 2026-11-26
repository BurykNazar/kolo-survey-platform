import { Op, UniqueConstraintError } from 'sequelize';
import bcrypt from 'bcryptjs';
import {
  Survey,
  SurveyCategory,
  Question,
  SurveyResult,
  User
} from '../db/models.js';
import {
  attemptsBySurvey,
  canManageSurvey,
  categoryCounts,
  deleteQuestionCascade,
  deleteSurveyCascade,
  isOpen,
  loadSurveyBundle,
  nextQuestionOrder,
  reorderQuestions,
  syncOptions
} from '../services/surveys.js';
import { attemptList, attemptStats } from '../services/answers.js';
import {
  adminBreakdown,
  attemptsPerSurvey,
  dailyAttempts,
  platformCounts,
  recentActivity,
  totalsFor,
  visitorOverview
} from '../services/stats.js';
import {
  parseId,
  validateCategoryInput,
  validateQuestionInput,
  validateSurveyInput,
  validateUserInput
} from '../lib/validation.js';
import { changePassword, updateProfile } from './auth.controller.js';

function renderHtml(res, view, data) {
  return new Promise((resolve, reject) => {
    res.render(view, data, (error, html) => (error ? reject(error) : resolve(html)));
  });
}

function deny(req, res, message = 'Для цієї дії бракує прав.') {
  if (req.wantsJson) return res.status(403).json({ ok: false, message });
  return res.status(403).render('pages/error.njk', {
    status: 403,
    title: 'Доступ обмежено',
    message
  });
}

function reject(req, res, status, message, errors = {}) {
  if (req.wantsJson) return res.status(status).json({ ok: false, message, errors });
  return res.redirect(`${req.path}?err=${encodeURIComponent(message)}`);
}

function done(req, res, payload = {}) {
  if (req.wantsJson) return res.json({ ok: true, ...payload });
  return res.redirect(payload.redirect || req.originalUrl);
}

function surveyCountsById(surveys, attemptsMap) {
  const counts = {};
  for (const survey of surveys) counts[survey.id] = attemptsMap.get(survey.id) || 0;
  return counts;
}

function questionPayload(questions) {
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

async function surveysForUser(user) {
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

async function canManageSurveyById(user, surveyId) {
  const survey = await Survey.findByPk(surveyId);
  if (!survey) return null;
  return canManageSurvey(user, survey) ? survey : null;
}

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

// ── Список опитувань ─────────────────────────────────────────────────────────

export async function getSurveys(req, res, next) {
  try {
    const surveys = await surveysForUser(req.user);
    const attemptsMap = await attemptsBySurvey(surveys.map((survey) => survey.id));
    const categories = await categoryCounts();
    const creators =
      req.user.role === 'admin'
        ? await User.findAll({ where: { role: { [Op.in]: ['creator', 'admin'] } }, order: [['full_name', 'ASC']], raw: true })
        : [];

    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const filtered = status === 'all' ? surveys : surveys.filter((survey) => survey.status === status);

    return res.render('pages/surveys.njk', {
      title: 'Опитування — Kolo',
      surveys: filtered,
      allCount: surveys.length,
      counts: surveyCountsById(surveys, attemptsMap),
      categories,
      creators,
      activeStatus: status,
      statusTotals: {
        all: surveys.length,
        active: surveys.filter((survey) => survey.status === 'active').length,
        draft: surveys.filter((survey) => survey.status === 'draft').length,
        closed: surveys.filter((survey) => survey.status === 'closed').length
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function createSurvey(req, res, next) {
  try {
    const { errors, data } = validateSurveyInput(req.body);
    const category = data.category_id ? await SurveyCategory.findByPk(data.category_id) : null;
    if (!category) errors.category_id = 'Такої категорії немає.';

    let creatorId = req.user.id;
    if (req.user.role === 'admin' && req.body.creator_id) {
      const requested = await User.findOne({ where: { id: parseId(req.body.creator_id), is_active: true } });
      if (!requested) errors.creator_id = 'Оберіть автора зі списку.';
      else creatorId = requested.id;
    }

    if (Object.keys(errors).length > 0) {
      return reject(req, res, 422, 'Перевірте поля опитування.', errors);
    }

    const survey = await Survey.create({
      ...data,
      creator_id: creatorId,
      status: data.status || 'draft'
    });

    return done(req, res, {
      message: 'Опитування створено.',
      redirect: `/studio/surveys/${survey.id}`,
      surveyId: survey.id
    });
  } catch (error) {
    return next(error);
  }
}

export async function getBuilder(req, res, next) {
  try {
    const survey = await loadSurveyBundle(req.params.id);
    if (!survey) {
      return res.status(404).render('pages/error.njk', {
        status: 404,
        title: 'Опитування не знайдено',
        message: 'Можливо, його вже видалили.'
      });
    }
    if (!canManageSurvey(req.user, survey)) {
      return deny(req, res, 'Ви можете редагувати лише власні опитування.');
    }

    const attempts = await SurveyResult.count({
      where: { survey_id: survey.id },
      distinct: true,
      col: 'session_id'
    });
    const categories = await SurveyCategory.findAll({ order: [['name', 'ASC']] });

    return res.render('pages/builder.njk', {
      title: `${survey.title} — Kolo`,
      survey,
      questionData: questionPayload(survey.questions),
      categories,
      attempts,
      canCopy: req.user.role === 'admin',
      creators:
        req.user.role === 'admin'
          ? await User.findAll({ where: { role: 'creator', is_active: true }, order: [['full_name', 'ASC']], raw: true })
          : []
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateSurvey(req, res, next) {
  try {
    const survey = await canManageSurveyById(req.user, req.params.id);
    if (!survey) return deny(req, res, 'Ви можете редагувати лише власні опитування.');

    const { errors, data } = validateSurveyInput(req.body);
    const category = data.category_id ? await SurveyCategory.findByPk(data.category_id) : null;
    if (!category) errors.category_id = 'Такої категорії немає.';

    if (Object.keys(errors).length > 0) {
      return reject(req, res, 422, 'Перевірте поля опитування.', errors);
    }

    if (req.user.role === 'admin' && req.body.creator_id) {
      const creator = await User.findByPk(parseId(req.body.creator_id));
      if (creator) data.creator_id = creator.id;
    }

    await survey.update(data);
    return done(req, res, {
      message: 'Зміни збережено.',
      survey: {
        title: data.title,
        status: data.status,
        estimated_minutes: data.estimated_minutes,
        is_anonymous: data.is_anonymous
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateSurveyStatus(req, res, next) {
  try {
    const survey = await canManageSurveyById(req.user, req.params.id);
    if (!survey) return deny(req, res, 'Ви можете змінювати лише власні опитування.');

    const status = String(req.body.status || '');
    if (!['draft', 'active', 'closed'].includes(status)) {
      return reject(req, res, 422, 'Невідомий статус.');
    }

    await survey.update({ status });
    const labels = { draft: 'Чернетка', active: 'Активне', closed: 'Завершене' };
    return done(req, res, { message: `Статус: ${labels[status]}.`, status, label: labels[status] });
  } catch (error) {
    return next(error);
  }
}

export async function deleteSurvey(req, res, next) {
  try {
    const survey = await canManageSurveyById(req.user, req.params.id);
    if (!survey) return deny(req, res, 'Ви можете видаляти лише власні опитування.');

    await deleteSurveyCascade(survey.id);
    return done(req, res, {
      message: 'Опитування видалено разом із питаннями та відповідями.',
      redirect: '/studio/surveys',
      removedId: survey.id
    });
  } catch (error) {
    return next(error);
  }
}

export async function copySurvey(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);

    const source = await loadSurveyBundle(req.params.id);
    if (!source) return reject(req, res, 404, 'Вихідне опитування не знайдено.');

    const creator = await User.findOne({ where: { id: parseId(req.body.creator_id), is_active: true } });
    if (!creator) return reject(req, res, 422, 'Оберіть автора для копії.', { creator_id: 'Оберіть автора.' });

    const copy = await Survey.create({
      category_id: source.category_id,
      creator_id: creator.id,
      title: String(req.body.title || `Копія — ${source.title}`).trim().slice(0, 255),
      description: source.description,
      status: 'draft',
      estimated_minutes: source.estimated_minutes,
      is_anonymous: source.is_anonymous,
      expires_at: null
    });

    for (const question of source.questions) {
      const created = await Question.create({
        survey_id: copy.id,
        question_text: question.question_text,
        question_type: question.question_type,
        order_num: question.order_num,
        is_required: question.is_required,
        hint: question.hint
      });
      for (const option of question.options) {
        await syncOptions(created.id, [option.option_text]);
      }
    }

    return done(req, res, {
      message: `Копію створено для ${creator.full_name}.`,
      redirect: `/studio/surveys/${copy.id}`
    });
  } catch (error) {
    return next(error);
  }
}

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

// ── Відповіді ────────────────────────────────────────────────────────────────

async function scopedSurveyIds(user) {
  if (user.role === 'admin') {
    const rows = await Survey.findAll({ attributes: ['id'], raw: true });
    return rows.map((row) => row.id);
  }
  const rows = await Survey.findAll({ where: { creator_id: user.id }, attributes: ['id'], raw: true });
  return rows.map((row) => row.id);
}

async function viewerSurveyIds(user) {
  if (user.role === 'visitor') {
    const rows = await SurveyResult.findAll({ where: { user_id: user.id }, attributes: ['survey_id'], raw: true });
    return [...new Set(rows.map((row) => row.survey_id))];
  }
  return scopedSurveyIds(user);
}

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

// ── Категорії ────────────────────────────────────────────────────────────────

async function categoryRows(req, res) {
  const categories = await categoryCounts();
  return renderHtml(res, 'partials/category-rows.njk', { categories });
}

export async function getCategories(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res, 'Категорії налаштовує адміністратор.');
    const categories = await categoryCounts();
    return res.render('pages/categories.njk', { title: 'Категорії — Kolo', categories });
  } catch (error) {
    return next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const { errors, data } = validateCategoryInput(req.body);
    if (Object.keys(errors).length > 0) return reject(req, res, 422, 'Перевірте категорію.', errors);

    try {
      await SurveyCategory.create(data);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return reject(req, res, 409, 'Така назва або код уже є.', { name: 'Перевірте назву та код.' });
      }
      throw error;
    }

    return done(req, res, { message: 'Категорію створено.', html: await categoryRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const category = await SurveyCategory.findByPk(req.params.id);
    if (!category) return reject(req, res, 404, 'Категорію не знайдено.');

    const { errors, data } = validateCategoryInput(req.body);
    if (Object.keys(errors).length > 0) return reject(req, res, 422, 'Перевірте категорію.', errors);

    try {
      await category.update(data);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return reject(req, res, 409, 'Така назва або код уже є.', { name: 'Перевірте назву та код.' });
      }
      throw error;
    }

    return done(req, res, { message: 'Категорію оновлено.', html: await categoryRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

export async function removeCategory(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const category = await SurveyCategory.findByPk(req.params.id);
    if (!category) return reject(req, res, 404, 'Категорію не знайдено.');

    const used = await Survey.count({ where: { category_id: category.id } });
    if (used > 0) {
      return reject(req, res, 409, 'У категорії ще є опитування. Спершу перенесіть їх.', {
        _global: 'Спершу перенесіть опитування в іншу категорію.'
      });
    }

    await category.destroy();
    return done(req, res, { message: 'Категорію видалено.', html: await categoryRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

// ── Люди ─────────────────────────────────────────────────────────────────────

async function peopleRows(req, res) {
  const people = await User.findAll({
    attributes: { exclude: ['password_hash'] },
    order: [['role', 'ASC'], ['full_name', 'ASC']],
    raw: true
  });

  const surveys = await Survey.findAll({ attributes: ['creator_id'], raw: true });
  const responses = await SurveyResult.findAll({ attributes: ['user_id'], raw: true });
  const surveyCount = new Map();
  const responseCount = new Map();
  for (const row of surveys) surveyCount.set(row.creator_id, (surveyCount.get(row.creator_id) || 0) + 1);
  for (const row of responses) if (row.user_id) responseCount.set(row.user_id, (responseCount.get(row.user_id) || 0) + 1);

  for (const person of people) {
    person.survey_count = surveyCount.get(person.id) || 0;
    person.response_count = responseCount.get(person.id) || 0;
  }

  return renderHtml(res, 'partials/people-rows.njk', { people, currentUserId: req.user.id });
}

export async function getPeople(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res, 'Керування людьми доступне адміністратору.');
    const people = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      order: [['role', 'ASC'], ['full_name', 'ASC']],
      raw: true
    });
    const surveys = await Survey.findAll({ attributes: ['creator_id'], raw: true });
    const responses = await SurveyResult.findAll({ attributes: ['user_id'], raw: true });
    const surveyCount = new Map();
    const responseCount = new Map();
    for (const row of surveys) surveyCount.set(row.creator_id, (surveyCount.get(row.creator_id) || 0) + 1);
    for (const row of responses) if (row.user_id) responseCount.set(row.user_id, (responseCount.get(row.user_id) || 0) + 1);
    for (const person of people) {
      person.survey_count = surveyCount.get(person.id) || 0;
      person.response_count = responseCount.get(person.id) || 0;
    }

    return res.render('pages/people.njk', {
      title: 'Люди — Kolo',
      people,
      currentUserId: req.user.id
    });
  } catch (error) {
    return next(error);
  }
}

export async function createPerson(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const { errors, data } = validateUserInput(req.body, { requirePassword: true });
    if (Object.keys(errors).length > 0) return reject(req, res, 422, 'Перевірте дані людини.', errors);

    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) return reject(req, res, 409, 'Ця пошта вже використовується.', { email: 'Пошта вже зайнята.' });

    await User.create({
      full_name: data.full_name,
      email: data.email,
      password_hash: await bcrypt.hash(data.password, 12),
      role: data.role,
      institution: data.institution,
      phone: data.phone,
      is_active: req.body.is_active !== 'false'
    });

    return done(req, res, { message: 'Людину додано.', html: await peopleRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

export async function updatePerson(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const person = await User.findByPk(req.params.id);
    if (!person) return reject(req, res, 404, 'Користувача не знайдено.');

    const { errors, data } = validateUserInput(req.body, { requirePassword: false });
    if (Object.keys(errors).length > 0) return reject(req, res, 422, 'Перевірте дані людини.', errors);

    if (data.email !== person.email) {
      const existing = await User.findOne({ where: { email: data.email } });
      if (existing) return reject(req, res, 409, 'Ця пошта вже використовується.', { email: 'Пошта вже зайнята.' });
    }

    if (person.role === 'admin' && data.role !== 'admin') {
      const admins = await User.count({ where: { role: 'admin', is_active: true } });
      if (admins <= 1) {
        return reject(req, res, 409, 'Це останній адміністратор — змініть роль іншому.', {
          role: 'Спершу призначте іншого адміністратора.'
        });
      }
    }

    const updates = {
      full_name: data.full_name,
      email: data.email,
      role: data.role,
      institution: data.institution,
      phone: data.phone,
      is_active: req.body.is_active !== 'false'
    };
    if (data.password) updates.password_hash = await bcrypt.hash(data.password, 12);

    await person.update(updates);
    return done(req, res, { message: 'Дані оновлено.', html: await peopleRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

export async function removePerson(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const person = await User.findByPk(req.params.id);
    if (!person) return reject(req, res, 404, 'Користувача не знайдено.');
    if (person.id === req.user.id) return reject(req, res, 409, 'Не можна видалити власний акаунт.');

    if (person.role === 'admin') {
      const admins = await User.count({ where: { role: 'admin', is_active: true } });
      if (admins <= 1) return reject(req, res, 409, 'Це останній адміністратор.');
    }

    // Звільняємо зв’язки, щоб не втратити чужі опитування й відповіді
    await Survey.update({ creator_id: req.user.id }, { where: { creator_id: person.id } });
    await SurveyResult.update({ user_id: null, is_anonymous: true }, { where: { user_id: person.id } });
    await person.destroy();

    return done(req, res, { message: 'Користувача видалено.', html: await peopleRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

// ── Профіль ──────────────────────────────────────────────────────────────────

export async function getProfile(req, res, next) {
  try {
    const surveyIds =
      req.user.role === 'creator'
        ? (await Survey.findAll({ where: { creator_id: req.user.id }, attributes: ['id'] })).map((row) => row.id)
        : [];

    const totals = req.user.role === 'creator' ? await totalsFor(surveyIds) : { attempts: 0, answers: 0 };
    const ownResponses = await SurveyResult.count({ where: { user_id: req.user.id }, distinct: true, col: 'session_id' });

    return res.render('pages/profile.njk', {
      title: 'Профіль — Kolo',
      profileUser: req.user,
      totals,
      ownResponses,
      surveyCount: surveyIds.length
    });
  } catch (error) {
    return next(error);
  }
}

export { updateProfile, changePassword };

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op, UniqueConstraintError } from 'sequelize';
import {
  Survey,
  SurveyCategory,
  Question,
  AnswerOption,
  SurveyResult,
  User
} from '../db/models.js';
import { env } from '../config/env.js';
import {
  activeSurveyWhere,
  canManageSurvey,
  deleteQuestionCascade,
  deleteSurveyCascade,
  isOpen,
  loadSurveyBundle,
  nextQuestionOrder,
  syncOptions
} from '../services/surveys.js';
import {
  parseId,
  validateCategoryInput,
  validateQuestionInput,
  validateSurveyInput,
  validateUserInput
} from '../lib/validation.js';

function apiError(res, status, message, errors) {
  return res.status(status).json({ ok: false, message, ...(errors ? { errors } : {}) });
}

function apiData(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export async function apiLogin(req, res, next) {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    if (!email || !password) return apiError(res, 422, 'Передайте email і password.');

    const user = await User.findOne({ where: { email, is_active: true } });
    if (!user) return apiError(res, 401, 'Невірні облікові дані.');

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) return apiError(res, 401, 'Невірні облікові дані.');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      env.jwtSecret,
      { expiresIn: '8h' }
    );

    return res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.full_name, email: user.email, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
}

export function apiMe(req, res) {
  return apiData(res, {
    id: req.user.id,
    name: req.user.full_name,
    email: req.user.email,
    role: req.user.role,
    institution: req.user.institution
  });
}

export async function apiListSurveys(req, res, next) {
  try {
    const where = req.user?.role === 'admin' || req.user?.role === 'creator' ? {} : activeSurveyWhere();
    if (req.user?.role === 'creator' && req.query.mine === 'true') where.creator_id = req.user.id;
    const surveys = await Survey.findAll({
      where,
      include: [
        { model: SurveyCategory, as: 'category', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'creator', attributes: ['id', 'full_name'] }
      ],
      order: [['created_at', 'DESC']]
    });
    return apiData(res, surveys);
  } catch (error) {
    return next(error);
  }
}

export async function apiGetSurvey(req, res, next) {
  try {
    const survey = await loadSurveyBundle(req.params.id);
    if (!survey) return apiError(res, 404, 'Опитування не знайдено.');
    if (req.user?.role === 'visitor' && !isOpen(survey)) {
      return apiError(res, 404, 'Опитування не знайдено.');
    }
    return apiData(res, survey);
  } catch (error) {
    return next(error);
  }
}

export async function apiCreateSurvey(req, res, next) {
  try {
    if (!['admin', 'creator'].includes(req.user.role)) return apiError(res, 403, 'Недостатньо прав.');
    const { errors, data } = validateSurveyInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);
    if (!(await SurveyCategory.findByPk(data.category_id))) return apiError(res, 422, 'Категорію не знайдено.', { category_id: 'Оберіть категорію.' });

    const survey = await Survey.create({
      ...data,
      creator_id: req.user.role === 'admin' ? parseId(req.body.creator_id) || req.user.id : req.user.id
    });
    return apiData(res, survey, 201);
  } catch (error) {
    return next(error);
  }
}

export async function apiUpdateSurvey(req, res, next) {
  try {
    const survey = await Survey.findByPk(req.params.id);
    if (!survey) return apiError(res, 404, 'Опитування не знайдено.');
    if (!canManageSurvey(req.user, survey)) return apiError(res, 403, 'Недостатньо прав.');

    const { errors, data } = validateSurveyInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);
    await survey.update(data);
    return apiData(res, survey);
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteSurvey(req, res, next) {
  try {
    const survey = await Survey.findByPk(req.params.id);
    if (!survey) return apiError(res, 404, 'Опитування не знайдено.');
    if (!canManageSurvey(req.user, survey)) return apiError(res, 403, 'Недостатньо прав.');
    await deleteSurveyCascade(survey.id);
    return apiData(res, { removed: survey.id });
  } catch (error) {
    return next(error);
  }
}

export async function apiListCategories(req, res, next) {
  try {
    const categories = await SurveyCategory.findAll({ order: [['name', 'ASC']] });
    return apiData(res, categories);
  } catch (error) {
    return next(error);
  }
}

export async function apiCreateCategory(req, res, next) {
  try {
    if (req.user.role !== 'admin') return apiError(res, 403, 'Недостатньо прав.');
    const { errors, data } = validateCategoryInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);
    const category = await SurveyCategory.create(data);
    return apiData(res, category, 201);
  } catch (error) {
    if (error instanceof UniqueConstraintError) return apiError(res, 409, 'Назва або код уже зайняті.');
    return next(error);
  }
}

export async function apiUpdateCategory(req, res, next) {
  try {
    if (req.user.role !== 'admin') return apiError(res, 403, 'Недостатньо прав.');
    const category = await SurveyCategory.findByPk(req.params.id);
    if (!category) return apiError(res, 404, 'Категорію не знайдено.');
    const { errors, data } = validateCategoryInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);
    await category.update(data);
    return apiData(res, category);
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteCategory(req, res, next) {
  try {
    if (req.user.role !== 'admin') return apiError(res, 403, 'Недостатньо прав.');
    const category = await SurveyCategory.findByPk(req.params.id);
    if (!category) return apiError(res, 404, 'Категорію не знайдено.');
    if (await Survey.count({ where: { category_id: category.id } })) {
      return apiError(res, 409, 'У категорії є опитування.');
    }
    await category.destroy();
    return apiData(res, { removed: category.id });
  } catch (error) {
    return next(error);
  }
}

export async function apiListUsers(req, res, next) {
  try {
    if (req.user.role !== 'admin') return apiError(res, 403, 'Недостатньо прав.');
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      order: [['full_name', 'ASC']]
    });
    return apiData(res, users);
  } catch (error) {
    return next(error);
  }
}

export async function apiCreateUser(req, res, next) {
  try {
    if (req.user.role !== 'admin') return apiError(res, 403, 'Недостатньо прав.');
    const { errors, data } = validateUserInput(req.body, { requirePassword: true });
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);
    if (await User.findOne({ where: { email: data.email } })) return apiError(res, 409, 'Пошта вже зайнята.');

    const user = await User.create({
      full_name: data.full_name,
      email: data.email,
      password_hash: await bcrypt.hash(data.password, 12),
      role: data.role,
      institution: data.institution,
      phone: data.phone,
      is_active: true
    });
    return apiData(res, { id: user.id, full_name: user.full_name, email: user.email, role: user.role }, 201);
  } catch (error) {
    return next(error);
  }
}

export async function apiUpdateUser(req, res, next) {
  try {
    if (req.user.role !== 'admin') return apiError(res, 403, 'Недостатньо прав.');
    const user = await User.findByPk(req.params.id);
    if (!user) return apiError(res, 404, 'Користувача не знайдено.');
    const { errors, data } = validateUserInput(req.body, { requirePassword: false });
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);

    const updates = {
      full_name: data.full_name,
      email: data.email,
      role: data.role,
      institution: data.institution,
      phone: data.phone
    };
    if (data.password) updates.password_hash = await bcrypt.hash(data.password, 12);
    await user.update(updates);
    return apiData(res, { id: user.id, full_name: user.full_name, email: user.email, role: user.role });
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteUser(req, res, next) {
  try {
    if (req.user.role !== 'admin') return apiError(res, 403, 'Недостатньо прав.');
    if (Number(req.params.id) === req.user.id) return apiError(res, 409, 'Не можна видалити власний акаунт.');
    const user = await User.findByPk(req.params.id);
    if (!user) return apiError(res, 404, 'Користувача не знайдено.');
    await Survey.update({ creator_id: req.user.id }, { where: { creator_id: user.id } });
    await SurveyResult.update({ user_id: null, is_anonymous: true }, { where: { user_id: user.id } });
    await user.destroy();
    return apiData(res, { removed: Number(req.params.id) });
  } catch (error) {
    return next(error);
  }
}

async function questionAccess(user, questionId) {
  const question = await Question.findByPk(questionId);
  if (!question) return { question: null };
  const survey = await Survey.findByPk(question.survey_id);
  return { question, survey, allowed: canManageSurvey(user, survey) };
}

export async function apiListQuestions(req, res, next) {
  try {
    const where = req.query.survey_id ? { survey_id: parseId(req.query.survey_id) } : {};
    const questions = await Question.findAll({
      where,
      include: [{ model: AnswerOption, as: 'options' }],
      order: [['survey_id', 'ASC'], ['order_num', 'ASC']]
    });
    return apiData(res, questions);
  } catch (error) {
    return next(error);
  }
}

export async function apiCreateQuestion(req, res, next) {
  try {
    const surveyId = parseId(req.body.survey_id);
    const survey = surveyId ? await Survey.findByPk(surveyId) : null;
    if (!survey) return apiError(res, 404, 'Опитування не знайдено.');
    if (!canManageSurvey(req.user, survey)) return apiError(res, 403, 'Недостатньо прав.');

    const { errors, data } = validateQuestionInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);

    const question = await Question.create({
      survey_id: survey.id,
      question_text: data.question_text,
      question_type: data.question_type,
      order_num: data.order_num || (await nextQuestionOrder(survey.id)),
      is_required: data.is_required,
      hint: data.hint
    });
    if (['single_choice', 'multiple_choice'].includes(data.question_type) && data.options.length > 0) {
      await syncOptions(question.id, data.options, data.option_ids);
    }
    return apiData(res, await Question.findByPk(question.id, { include: [{ model: AnswerOption, as: 'options' }] }), 201);
  } catch (error) {
    return next(error);
  }
}

export async function apiUpdateQuestion(req, res, next) {
  try {
    const { question, survey, allowed } = await questionAccess(req.user, req.params.id);
    if (!question) return apiError(res, 404, 'Питання не знайдено.');
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');

    const { errors, data } = validateQuestionInput(req.body);
    if (Object.keys(errors).length > 0) return apiError(res, 422, 'Перевірте поля.', errors);

    await question.update({
      question_text: data.question_text,
      question_type: data.question_type,
      order_num: data.order_num || question.order_num,
      is_required: data.is_required,
      hint: data.hint
    });
    if (['single_choice', 'multiple_choice'].includes(data.question_type)) {
      await syncOptions(question.id, data.options, data.option_ids);
    } else {
      await syncOptions(question.id, []);
    }
    return apiData(res, await Question.findByPk(question.id, { include: [{ model: AnswerOption, as: 'options' }] }));
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteQuestion(req, res, next) {
  try {
    const { question, allowed } = await questionAccess(req.user, req.params.id);
    if (!question) return apiError(res, 404, 'Питання не знайдено.');
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');
    await deleteQuestionCascade(question.id);
    return apiData(res, { removed: question.id });
  } catch (error) {
    return next(error);
  }
}

export async function apiListOptions(req, res, next) {
  try {
    const where = req.query.question_id ? { question_id: parseId(req.query.question_id) } : {};
    const options = await AnswerOption.findAll({ where, order: [['question_id', 'ASC'], ['order_num', 'ASC']] });
    return apiData(res, options);
  } catch (error) {
    return next(error);
  }
}

export async function apiCreateOption(req, res, next) {
  try {
    const questionId = parseId(req.body.question_id);
    const { question, allowed } = await questionAccess(req.user, questionId);
    if (!question) return apiError(res, 404, 'Питання не знайдено.');
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');
    const text = String(req.body.option_text || '').trim().slice(0, 255);
    if (!text) return apiError(res, 422, 'Впишіть текст варіанта.', { option_text: 'Поле обов’язкове.' });

    const max = await AnswerOption.max('order_num', { where: { question_id: question.id } });
    const option = await AnswerOption.create({
      question_id: question.id,
      option_text: text,
      order_num: (Number(max) || 0) + 1
    });
    return apiData(res, option, 201);
  } catch (error) {
    return next(error);
  }
}

export async function apiUpdateOption(req, res, next) {
  try {
    const option = await AnswerOption.findByPk(req.params.id);
    if (!option) return apiError(res, 404, 'Варіант не знайдено.');
    const { allowed } = await questionAccess(req.user, option.question_id);
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');

    const text = String(req.body.option_text || '').trim().slice(0, 255);
    if (!text) return apiError(res, 422, 'Впишіть текст варіанта.');
    await option.update({ option_text: text, order_num: Number(req.body.order_num) || option.order_num });
    return apiData(res, option);
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteOption(req, res, next) {
  try {
    const option = await AnswerOption.findByPk(req.params.id);
    if (!option) return apiError(res, 404, 'Варіант не знайдено.');
    const { allowed } = await questionAccess(req.user, option.question_id);
    if (!allowed) return apiError(res, 403, 'Недостатньо прав.');
    await SurveyResult.destroy({ where: { option_id: option.id } });
    await option.destroy();
    return apiData(res, { removed: option.id });
  } catch (error) {
    return next(error);
  }
}

export async function apiListResults(req, res, next) {
  try {
    const where = {};
    let ownSurveyIds = null;

    if (req.user.role === 'creator') {
      const surveys = await Survey.findAll({ where: { creator_id: req.user.id }, attributes: ['id'], raw: true });
      ownSurveyIds = surveys.map((row) => row.id);
      where.survey_id = { [Op.in]: ownSurveyIds };
    } else if (req.user.role === 'visitor') {
      where.user_id = req.user.id;
    }

    if (req.query.survey_id) {
      const requested = parseId(req.query.survey_id);
      if (!requested) return apiError(res, 422, 'Некоректний survey_id.');
      if (ownSurveyIds && !ownSurveyIds.includes(requested)) {
        return apiError(res, 403, 'Це опитування належить іншому авторові.');
      }
      where.survey_id = requested;
    }

    const results = await SurveyResult.findAll({ where, order: [['answered_at', 'DESC']], limit: 500 });
    return apiData(res, results);
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteResult(req, res, next) {
  try {
    const result = await SurveyResult.findByPk(req.params.id);
    if (!result) return apiError(res, 404, 'Відповідь не знайдено.');
    const survey = await Survey.findByPk(result.survey_id);
    if (!canManageSurvey(req.user, survey)) return apiError(res, 403, 'Недостатньо прав.');
    await result.destroy();
    return apiData(res, { removed: result.id });
  } catch (error) {
    return next(error);
  }
}

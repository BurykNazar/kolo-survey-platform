import { Survey, SurveyCategory, User } from '../../db/models.js';
import {
  activeSurveyWhere,
  canManageSurvey,
  deleteSurveyCascade,
  isOpen,
  loadSurveyBundle
} from '../../services/surveys.js';
import { parseId, validateSurveyInput } from '../../lib/validation.js';
import { apiData, apiError } from './shared.js';

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

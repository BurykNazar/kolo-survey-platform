import { UniqueConstraintError } from 'sequelize';
import { Survey, SurveyCategory } from '../../db/models.js';
import { validateCategoryInput } from '../../lib/validation.js';
import { apiData, apiError } from './shared.js';

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

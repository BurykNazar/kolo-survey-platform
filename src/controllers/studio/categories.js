import { UniqueConstraintError } from 'sequelize';
import { Survey, SurveyCategory } from '../../db/models.js';
import { categoryCounts } from '../../services/surveys.js';
import { validateCategoryInput } from '../../lib/validation.js';
import { deny, done, reject, renderHtml } from './shared.js';

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

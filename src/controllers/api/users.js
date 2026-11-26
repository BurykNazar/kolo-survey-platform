import bcrypt from 'bcryptjs';
import { Survey, SurveyResult, User } from '../../db/models.js';
import { validateUserInput } from '../../lib/validation.js';
import { deleteDraftsForUser } from '../../services/drafts.js';
import { apiData, apiError } from './shared.js';

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
    await deleteDraftsForUser(user.id);
    await user.destroy();
    return apiData(res, { removed: Number(req.params.id) });
  } catch (error) {
    return next(error);
  }
}

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../db/models.js';
import { env } from '../../config/env.js';
import { apiData, apiError } from './shared.js';

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

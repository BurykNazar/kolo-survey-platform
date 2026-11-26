import bcrypt from 'bcryptjs';
import passport from '../config/passport.js';
import { User } from '../db/models.js';
import { isEmail, passwordProblem, safeReturnTo, str, validateRegistration } from '../lib/validation.js';
import { authShowcase, loginData, respondLogin, respondRegister } from './auth.helpers.js';

export async function getLogin(req, res) {
  return res.render('pages/auth-login.njk', {
    ...loginData(req),
    showcase: await authShowcase()
  });
}

export function postLogin(req, res, next) {
  const email = str(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const returnTo = safeReturnTo(req.body.returnTo, '/studio');
  const errors = {};

  if (!email) errors.email = 'Вкажіть електронну пошту.';
  else if (!isEmail(email)) errors.email = 'Перевірте адресу: потрібен формат name@domain.ua.';
  if (!password) errors.password = 'Введіть пароль.';

  if (Object.keys(errors).length > 0) {
    return respondLogin(req, res, { status: 422, errors, values: { email } });
  }

  passport.authenticate('local', (error, user, info) => {
    if (error) return next(error);
    if (!user) {
      return respondLogin(req, res, {
        status: 401,
        errors: { _global: info?.message || 'Невірна пошта або пароль.' },
        values: { email }
      });
    }

    return req.session.regenerate((regenError) => {
      if (regenError) return next(regenError);
      return req.logIn(user, (loginError) => {
        if (loginError) return next(loginError);
        if (req.wantsJson) {
          return res.json({ ok: true, message: 'Вітаємо!', redirect: returnTo });
        }
        return res.redirect(returnTo);
      });
    });
  })(req, res, next);
}

export async function getRegister(req, res) {
  return res.render('pages/auth-register.njk', {
    title: 'Реєстрація — Kolo',
    returnTo: safeReturnTo(req.query.returnTo, '/studio'),
    errors: {},
    values: {},
    showcase: await authShowcase()
  });
}

export async function postRegister(req, res, next) {
  const { errors, data } = validateRegistration(req.body);
  const returnTo = safeReturnTo(req.body.returnTo, '/studio');
  if (Object.keys(errors).length > 0) {
    return respondRegister(req, res, { status: 422, errors, values: { full_name: data.full_name, email: data.email, institution: data.institution } });
  }

  try {
    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) {
      return respondRegister(req, res, {
        status: 409,
        errors: { email: 'Ця пошта вже зареєстрована. Увійдіть або відновіть доступ.' },
        values: { full_name: data.full_name, email: data.email, institution: data.institution }
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({
      full_name: data.full_name,
      email: data.email,
      password_hash: passwordHash,
      role: 'visitor',
      institution: data.institution,
      phone: null,
      is_active: true
    });

    return req.session.regenerate((regenError) => {
      if (regenError) return next(regenError);
      return req.logIn(
        { id: user.id, full_name: user.full_name, email: user.email, role: user.role, institution: user.institution },
        (loginError) => {
          if (loginError) return next(loginError);
          if (req.wantsJson) {
            return res.json({
              ok: true,
              message: 'Акаунт створено. Вітаємо в Kolo!',
              redirect: returnTo
            });
          }
          return res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=${encodeURIComponent('Акаунт створено. Вітаємо в Kolo!')}`);
        }
      );
    });
  } catch (error) {
    return next(error);
  }
}

export function postLogout(req, res, next) {
  return req.logout((error) => {
    if (error) return next(error);
    return req.session.destroy((destroyError) => {
      if (destroyError) return next(destroyError);
      res.clearCookie('kolo.sid');
      if (req.wantsJson) return res.json({ ok: true, redirect: '/' });
      return res.redirect('/?ok=' + encodeURIComponent('Ви вийшли з акаунта.'));
    });
  });
}

export async function changePassword(req, res, next) {
  try {
    const current = String(req.body.current_password || '');
    const nextPassword = String(req.body.new_password || '');
    const repeat = String(req.body.repeat_password || '');
    const errors = {};

    if (!current) errors.current_password = 'Введіть поточний пароль.';
    const problem = passwordProblem(nextPassword);
    if (problem) errors.new_password = problem;
    if (nextPassword !== repeat) errors.repeat_password = 'Паролі не збігаються.';

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ ok: false, message: 'Перевірте поля пароля.', errors });
    }

    const user = await User.findByPk(req.user.id);
    const matches = await bcrypt.compare(current, user.password_hash);
    if (!matches) {
      return res.status(401).json({ ok: false, errors: { current_password: 'Поточний пароль невірний.' } });
    }

    user.password_hash = await bcrypt.hash(nextPassword, 12);
    await user.save();

    return res.json({ ok: true, message: 'Пароль оновлено.' });
  } catch (error) {
    return next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { validateProfileInput } = await import('../lib/validation.js');
    const { errors, data } = validateProfileInput(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ ok: false, message: 'Перевірте поля профілю.', errors });
    }

    const user = await User.findByPk(req.user.id);
    await user.update(data);
    req.user.full_name = data.full_name;
    req.user.institution = data.institution;
    req.user.phone = data.phone;

    return res.json({
      ok: true,
      message: 'Профіль оновлено.',
      user: { full_name: data.full_name, institution: data.institution, phone: data.phone }
    });
  } catch (error) {
    return next(error);
  }
}

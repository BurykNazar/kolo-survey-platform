import { safeReturnTo } from '../lib/validation.js';
import passport from '../config/passport.js';

export function authenticateJWT(req, res, next) {
  passport.authenticate('jwt', { session: false }, (error, user, info) => {
    if (error) return next(error);
    if (!user) {
      return res.status(401).json({
        ok: false,
        message: 'Потрібен дійсний токен доступу.',
        details: info?.message
      });
    }
    req.user = user;
    return next();
  })(req, res, next);
}

export function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.wantsJson) {
    return res.status(401).json({ ok: false, message: 'Увійдіть, щоб продовжити.' });
  }
  const returnTo = encodeURIComponent(req.originalUrl);
  return res.redirect(`/login?returnTo=${returnTo}`);
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return requireAuth(req, res, next);
    if (roles.includes(req.user.role)) return next();

    if (req.wantsJson) {
      return res.status(403).json({ ok: false, message: 'Для цієї дії бракує прав.' });
    }
    return res.status(403).render('pages/error.njk', {
      status: 403,
      title: 'Доступ обмежено',
      message: 'Ця сторінка доступна іншій ролі. Поверніться до свого огляду.'
    });
  };
}

export function requireStudio(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);
  return next();
}

export function guestOnly(req, res, next) {
  if (req.user) return res.redirect('/studio');
  return next();
}

export function loginReturnTo(value) {
  return safeReturnTo(value, '/studio');
}

export function ownsSurvey(user, survey) {
  if (!user || !survey) return false;
  if (user.role === 'admin') return true;
  return user.role === 'creator' && Number(survey.creator_id) === Number(user.id);
}

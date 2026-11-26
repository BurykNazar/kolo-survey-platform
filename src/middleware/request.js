import crypto from 'crypto';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requestShape(req, res, next) {
  const header = String(req.get('x-requested-with') || '').toLowerCase();
  const accept = String(req.get('accept') || '');
  req.wantsJson = header === 'fetch' || accept.includes('application/json') || req.path.startsWith('/api/');
  next();
}

export function csrfProtection(req, res, next) {
  if (!req.session) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('base64url');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (!MUTATING.has(req.method) || req.path.startsWith('/api/')) return next();

  const token = req.get('x-csrf-token') || (req.body && req.body._csrf);
  if (token && token === req.session.csrfToken) return next();

  if (req.wantsJson) {
    return res.status(403).json({
      ok: false,
      message: 'Сесія оновилася. Оновіть сторінку та спробуйте ще раз.'
    });
  }

  return res.status(403).render('pages/error.njk', {
    status: 403,
    title: 'Сесію оновлено',
    message: 'Сторінка втратила актуальний ключ безпеки. Поверніться назад і повторіть дію.'
  });
}

export function viewLocals(req, res, next) {
  res.locals.currentUser = req.user || null;
  res.locals.isAuthed = Boolean(req.user);
  res.locals.currentPath = req.originalUrl.split('?')[0];
  res.locals.query = req.query;
  res.locals.flash = {
    ok: typeof req.query.ok === 'string' ? req.query.ok : '',
    error: typeof req.query.err === 'string' ? req.query.err : ''
  };
  res.locals.year = new Date().getFullYear();
  res.locals.appName = 'Kolo';
  next();
}

export function redirectWith(res, path, { ok, err } = {}) {
  const params = new URLSearchParams();
  if (ok) params.set('ok', ok);
  if (err) params.set('err', err);
  const suffix = params.toString();
  return res.redirect(`${path}${suffix ? `?${suffix}` : ''}`);
}

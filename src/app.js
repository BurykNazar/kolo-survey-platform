import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import nunjucks from 'nunjucks';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

import { env } from './config/env.js';
import passport from './config/passport.js';
import { sequelize } from './db/models.js';
import { csrfProtection, requestShape, viewLocals } from './middleware/request.js';
import { requireStudio } from './middleware/auth.js';
import { helpers } from './lib/format.js';
import publicRoutes from './routes/public.routes.js';
import authRoutes from './routes/auth.routes.js';
import studioRoutes from './routes/studio.routes.js';
import apiRoutes from './routes/api.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PgSession = connectPgSimple(session);

app.set('trust proxy', env.trustProxy ? 1 : false);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);
app.use(compression());

app.get('/healthz', async (req, res) => {
  try {
    await sequelize.query('SELECT 1');
    res.json({ ok: true, service: 'kolo' });
  } catch {
    res.status(503).json({ ok: false });
  }
});

const viewsPath = path.join(__dirname, 'views');
const nunjucksEnv = nunjucks.configure(viewsPath, {
  autoescape: true,
  express: app,
  watch: !env.isProd,
  noCache: !env.isProd,
  throwOnUndefined: false
});

for (const [name, fn] of Object.entries(helpers)) {
  nunjucksEnv.addFilter(name, fn);
}

nunjucksEnv.addFilter('statusTone', (status) => ({ draft: 'neutral', active: 'positive', closed: 'muted' }[status] || 'neutral'));
nunjucksEnv.addFilter('starts', (value, prefix) => String(value || '').startsWith(prefix));
nunjucksEnv.addFilter('pad2', (value) => String(value ?? '').padStart(2, '0'));
nunjucksEnv.addFilter('dump', (value) => JSON.stringify(value));
nunjucksEnv.addFilter('percent', (value, total) => {
  if (!total) return 0;
  return Math.round((Number(value) / Number(total)) * 100);
});

nunjucksEnv.addGlobal('icon', (name, size = 20, cls = '') => {
  const safeName = String(name).replace(/[^a-z0-9-]/gi, '');
  const safeClass = String(cls).replace(/[^a-z0-9 _-]/gi, '');
  return new nunjucks.runtime.SafeString(
    `<svg class="icon ${safeClass}" width="${Number(size) || 20}" height="${Number(size) || 20}" aria-hidden="true" focusable="false"><use href="/img/icons.svg#i-${safeName}"></use></svg>`
  );
});

app.set('view engine', 'njk');
app.set('views', viewsPath);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: env.isProd ? '7d' : 0,
    etag: true
  })
);

app.use(
  session({
    store: new PgSession({
      conString: env.databaseUrl,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15
    }),
    name: 'kolo.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: env.isProd,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(requestShape);
app.use(viewLocals);
app.use(csrfProtection);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => !env.isProd,
  message: { ok: false, message: 'Забагато спроб. Спробуйте за кілька хвилин.' }
});

app.use(['/login', '/register'], authLimiter);
app.use(['/api/auth/login'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));

app.use('/api', apiRoutes);
app.use('/', authRoutes);
app.use('/studio', requireStudio, studioRoutes);
app.use('/', publicRoutes);

app.use((req, res) => {
  if (req.wantsJson || req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, message: 'Ресурс не знайдено.' });
  }
  return res.status(404).render('pages/error.njk', {
    status: 404,
    title: 'Сторінку не знайдено',
    message: 'Схоже, посилання застаріло або сторінку перейменували.'
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('[kolo]', error);

  if (req.wantsJson || req.path.startsWith('/api/')) {
    return res.status(error.status || 500).json({
      ok: false,
      message: 'Не вдалося виконати запит. Спробуйте ще раз.'
    });
  }

  return res.status(error.status || 500).render('pages/error.njk', {
    status: error.status || 500,
    title: 'Щось пішло не так',
    message: 'Ми вже бачимо помилку. Оновіть сторінку або поверніться на головну.'
  });
});

export default app;

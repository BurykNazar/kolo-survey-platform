import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Змінна середовища ${name} не задана. Скопіюйте .env.example у .env і заповніть значення.`);
  }
  return value.trim();
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const port = Number(process.env.PORT) || 3000;

const databaseUrl = required('DATABASE_URL');

const sessionSecret = process.env.SESSION_SECRET || '';
const jwtSecret = process.env.JWT_SECRET || '';

if (isProd && (sessionSecret.length < 32 || jwtSecret.length < 32)) {
  throw new Error('У production SESSION_SECRET і JWT_SECRET мають бути задані та містити щонайменше 32 символи.');
}

export const env = {
  nodeEnv,
  isProd,
  port,
  databaseUrl,
  sessionSecret: sessionSecret || 'kolo-local-development-session-secret',
  jwtSecret: jwtSecret || 'kolo-local-development-jwt-secret',
  appOrigin: (process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  trustProxy: isProd
};

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CREATOR: 'creator',
  VISITOR: 'visitor'
});

export const ROLE_LABELS = Object.freeze({
  admin: 'Адміністратор',
  creator: 'Дослідник',
  visitor: 'Учасник'
});

export const QUESTION_TYPES = Object.freeze({
  single_choice: 'Один варіант',
  multiple_choice: 'Кілька варіантів',
  text: 'Текстова відповідь',
  rating: 'Шкала 1–10'
});

export const SURVEY_STATUSES = Object.freeze({
  draft: 'Чернетка',
  active: 'Активне',
  closed: 'Завершене'
});

export const STATUS_TONES = Object.freeze({
  draft: 'neutral',
  active: 'positive',
  closed: 'muted'
});

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { sequelize, models } from '../src/db/models.js';
import { categories, people, surveys } from './seed-data.mjs';

const { User, SurveyCategory, Survey, Question, AnswerOption, SurveyResult } = models;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function generatePassword() {
  return crypto.randomBytes(18).toString('base64url');
}

// Детермінований генератор, щоб демо-дані були однаковими під час кожного сіду
function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261126);
const pick = (items) => items[Math.floor(rand() * items.length)];
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const hex = (bytes) => crypto.randomBytes(bytes).toString('hex');

function ratingDistribution() {
  const weights = [1, 2, 4, 6, 10, 14, 18, 20, 15, 10];
  const total = weights.reduce((sum, value) => sum + value, 0);
  let ticket = rand() * total;
  for (let i = 0; i < weights.length; i += 1) {
    ticket -= weights[i];
    if (ticket <= 0) return i + 1;
  }
  return 8;
}

export async function seed({ force = false, log = console.log } = {}) {
  const existingUsers = await User.count();
  if (existingUsers > 0 && !force) {
    log('База вже містить користувачів — сід пропущено.');
    return { skipped: true };
  }

  if (force) {
    await SurveyResult.destroy({ where: {}, truncate: true, restartIdentity: true, cascade: true });
    await AnswerOption.destroy({ where: {}, truncate: true, restartIdentity: true, cascade: true });
    await Question.destroy({ where: {}, truncate: true, restartIdentity: true, cascade: true });
    await Survey.destroy({ where: {}, truncate: true, restartIdentity: true, cascade: true });
    await SurveyCategory.destroy({ where: {}, truncate: true, restartIdentity: true, cascade: true });
    await User.destroy({ where: {}, truncate: true, restartIdentity: true, cascade: true });
  }

  const categoryByCode = new Map();
  for (const category of categories) {
    const row = await SurveyCategory.create(category);
    categoryByCode.set(category.code, row);
  }

  const accounts = [];
  const userByKey = new Map();
  for (const person of people) {
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      full_name: person.full_name,
      email: person.email.toLowerCase(),
      password_hash: passwordHash,
      role: person.role,
      institution: person.institution,
      phone: person.phone,
      is_active: true
    });
    userByKey.set(person.key, user);
    accounts.push({ ...person, password });
  }

  const visitors = people
    .filter((person) => person.role === 'visitor')
    .map((person) => userByKey.get(person.key));
  const now = Date.now();
  const totalAttempts = { count: 0 };

  for (const definition of surveys) {
    const survey = await Survey.create({
      category_id: categoryByCode.get(definition.category).id,
      creator_id: userByKey.get(definition.creator).id,
      title: definition.title,
      description: definition.description,
      status: definition.status,
      estimated_minutes: definition.minutes,
      is_anonymous: definition.anonymous,
      expires_at: definition.expiresInDays
        ? new Date(now + definition.expiresInDays * 24 * 60 * 60 * 1000)
        : null
    });

    const createdQuestions = [];
    let order = 1;
    for (const questionDefinition of definition.questions) {
      const question = await Question.create({
        survey_id: survey.id,
        question_text: questionDefinition.text,
        question_type: questionDefinition.type,
        order_num: order,
        is_required: questionDefinition.required !== false,
        hint: questionDefinition.hint || null
      });
      order += 1;

      const options = [];
      if (questionDefinition.options) {
        let optionOrder = 1;
        for (const label of questionDefinition.options) {
          options.push(
            await AnswerOption.create({
              question_id: question.id,
              option_text: label,
              order_num: optionOrder
            })
          );
          optionOrder += 1;
        }
      }

      createdQuestions.push({ question, options, definition: questionDefinition });
    }

    if (definition.attempts > 0 && definition.status !== 'draft') {
      const rows = [];
      for (let attempt = 0; attempt < definition.attempts; attempt += 1) {
        const recentNamed = definition.status === 'active' && !definition.anonymous && attempt === 0;
        const registered = recentNamed || rand() < 0.68;
        const respondent = registered ? pick(visitors) : null;
        const anonymous = definition.anonymous || !respondent || (!recentNamed && rand() < 0.1);
        const sessionId = `sess_${hex(8)}`;
        const answeredAt = recentNamed
          ? new Date(now - randInt(1, 5) * 3600000)
          : new Date(now - randInt(0, 21) * 86400000 - randInt(0, 82800) * 1000);

        for (const entry of createdQuestions) {
          const { question, options, definition: questionDefinition } = entry;
          const base = {
            survey_id: survey.id,
            question_id: question.id,
            user_id: anonymous ? null : respondent.id,
            session_id: sessionId,
            is_anonymous: anonymous,
            answered_at: answeredAt
          };

          if (question.question_type === 'rating') {
            rows.push({ ...base, rating_value: ratingDistribution() });
          } else if (question.question_type === 'text') {
            if (!question.is_required && rand() < 0.32) continue;
            const texts = questionDefinition.texts || ['Без коментарів.'];
            rows.push({ ...base, text_answer: pick(texts) });
          } else if (question.question_type === 'multiple_choice') {
            const selected = options.filter(() => rand() < 0.34);
            const chosen = selected.length > 0 ? selected : [pick(options)];
            const unique = [...new Set(chosen)].slice(0, 4);
            for (const option of unique) {
              rows.push({ ...base, option_id: option.id });
            }
          } else {
            rows.push({ ...base, option_id: pick(options).id });
          }
        }
      }

      await SurveyResult.bulkCreate(rows);
      totalAttempts.count += definition.attempts;
    }
  }

  const credentialsPath = path.join(__dirname, '..', 'credentials.local.md');
  const lines = [
    '# Kolo — демонстраційні облікові записи',
    '',
    'Сгенеровано `scripts/seed.mjs`. Файл у `.gitignore` і не потрапляє в репозиторій.',
    '',
    '| Роль | Ім’я | Email | Пароль |',
    '| --- | --- | --- | --- |',
    ...accounts.map((account) => `| ${account.role} | ${account.full_name} | ${account.email} | \`${account.password}\` |`)
  ];
  fs.writeFileSync(credentialsPath, `${lines.join('\n')}\n`, 'utf8');

  log('');
  log('Kolo: демонстраційні дані створено.');
  log(`  користувачів: ${accounts.length}`);
  log(`  опитувань: ${surveys.length}`);
  log(`  спроб: ${totalAttempts.count}`);
  log(`  паролі: ${credentialsPath}`);
  log('');
  for (const account of accounts) {
    log(`  ${account.role.padEnd(8)} ${account.email.padEnd(32)} ${account.password}`);
  }
  log('');

  return { skipped: false, accounts };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    await sequelize.authenticate();
    await seed({ force: process.argv.includes('--force') });
    await sequelize.close();
  } catch (error) {
    console.error('Помилка сіду:', error);
    process.exitCode = 1;
  }
}

import bcrypt from 'bcryptjs';
import { Survey, SurveyResult, User } from '../../db/models.js';
import { validateUserInput } from '../../lib/validation.js';
import { deleteDraftsForUser } from '../../services/drafts.js';
import { deny, done, reject, renderHtml } from './shared.js';

// ── Люди ─────────────────────────────────────────────────────────────────────

async function peopleRows(req, res) {
  const people = await User.findAll({
    attributes: { exclude: ['password_hash'] },
    order: [['role', 'ASC'], ['full_name', 'ASC']],
    raw: true
  });

  const surveys = await Survey.findAll({ attributes: ['creator_id'], raw: true });
  const responses = await SurveyResult.findAll({ attributes: ['user_id'], raw: true });
  const surveyCount = new Map();
  const responseCount = new Map();
  for (const row of surveys) surveyCount.set(row.creator_id, (surveyCount.get(row.creator_id) || 0) + 1);
  for (const row of responses) if (row.user_id) responseCount.set(row.user_id, (responseCount.get(row.user_id) || 0) + 1);

  for (const person of people) {
    person.survey_count = surveyCount.get(person.id) || 0;
    person.response_count = responseCount.get(person.id) || 0;
  }

  return renderHtml(res, 'partials/people-rows.njk', { people, currentUserId: req.user.id });
}

export async function getPeople(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res, 'Керування людьми доступне адміністратору.');
    const people = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      order: [['role', 'ASC'], ['full_name', 'ASC']],
      raw: true
    });
    const surveys = await Survey.findAll({ attributes: ['creator_id'], raw: true });
    const responses = await SurveyResult.findAll({ attributes: ['user_id'], raw: true });
    const surveyCount = new Map();
    const responseCount = new Map();
    for (const row of surveys) surveyCount.set(row.creator_id, (surveyCount.get(row.creator_id) || 0) + 1);
    for (const row of responses) if (row.user_id) responseCount.set(row.user_id, (responseCount.get(row.user_id) || 0) + 1);
    for (const person of people) {
      person.survey_count = surveyCount.get(person.id) || 0;
      person.response_count = responseCount.get(person.id) || 0;
    }

    return res.render('pages/people.njk', {
      title: 'Люди — Kolo',
      people,
      currentUserId: req.user.id
    });
  } catch (error) {
    return next(error);
  }
}

export async function createPerson(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const { errors, data } = validateUserInput(req.body, { requirePassword: true });
    if (Object.keys(errors).length > 0) return reject(req, res, 422, 'Перевірте дані людини.', errors);

    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) return reject(req, res, 409, 'Ця пошта вже використовується.', { email: 'Пошта вже зайнята.' });

    await User.create({
      full_name: data.full_name,
      email: data.email,
      password_hash: await bcrypt.hash(data.password, 12),
      role: data.role,
      institution: data.institution,
      phone: data.phone,
      is_active: req.body.is_active !== 'false'
    });

    return done(req, res, { message: 'Людину додано.', html: await peopleRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

export async function updatePerson(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const person = await User.findByPk(req.params.id);
    if (!person) return reject(req, res, 404, 'Користувача не знайдено.');

    const { errors, data } = validateUserInput(req.body, { requirePassword: false });
    if (Object.keys(errors).length > 0) return reject(req, res, 422, 'Перевірте дані людини.', errors);

    if (data.email !== person.email) {
      const existing = await User.findOne({ where: { email: data.email } });
      if (existing) return reject(req, res, 409, 'Ця пошта вже використовується.', { email: 'Пошта вже зайнята.' });
    }

    if (person.role === 'admin' && data.role !== 'admin') {
      const admins = await User.count({ where: { role: 'admin', is_active: true } });
      if (admins <= 1) {
        return reject(req, res, 409, 'Це останній адміністратор — змініть роль іншому.', {
          role: 'Спершу призначте іншого адміністратора.'
        });
      }
    }

    const updates = {
      full_name: data.full_name,
      email: data.email,
      role: data.role,
      institution: data.institution,
      phone: data.phone,
      is_active: req.body.is_active !== 'false'
    };
    if (data.password) updates.password_hash = await bcrypt.hash(data.password, 12);

    await person.update(updates);
    return done(req, res, { message: 'Дані оновлено.', html: await peopleRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

export async function removePerson(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);
    const person = await User.findByPk(req.params.id);
    if (!person) return reject(req, res, 404, 'Користувача не знайдено.');
    if (person.id === req.user.id) return reject(req, res, 409, 'Не можна видалити власний акаунт.');

    if (person.role === 'admin') {
      const admins = await User.count({ where: { role: 'admin', is_active: true } });
      if (admins <= 1) return reject(req, res, 409, 'Це останній адміністратор.');
    }

    // Звільняємо зв’язки, щоб не втратити чужі опитування й відповіді
    await Survey.update({ creator_id: req.user.id }, { where: { creator_id: person.id } });
    await SurveyResult.update({ user_id: null, is_anonymous: true }, { where: { user_id: person.id } });
    await deleteDraftsForUser(person.id);
    await person.destroy();

    return done(req, res, { message: 'Користувача видалено.', html: await peopleRows(req, res) });
  } catch (error) {
    return next(error);
  }
}

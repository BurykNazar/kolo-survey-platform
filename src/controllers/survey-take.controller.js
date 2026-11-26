import crypto from 'crypto';
import { Survey, Question, SurveyResult } from '../db/models.js';
import { canManageSurvey, isOpen, loadSurveyBundle } from '../services/surveys.js';
import { validateAnswers } from '../lib/validation.js';
import { deleteDraft, getDraft, saveDraft as saveDraftRecord } from '../services/drafts.js';

function renderView(res, view, data) {
  return new Promise((resolve, reject) => {
    res.render(view, data, (error, html) => (error ? reject(error) : resolve(html)));
  });
}

function draftValues(draft) {
  const values = draft?.payload?.values;
  return values && typeof values === 'object' ? values : {};
}

export async function renderSurveyPage(req, res, { status = 200, errors = {}, values = {}, message = '' } = {}) {
  const survey = await loadSurveyBundle(req.params.id);
  if (!survey) {
    return res.status(404).render('pages/error.njk', {
      status: 404,
      title: 'Опитування не знайдено',
      message: 'Можливо, автор його видалив або посилання змінилося.'
    });
  }

  const manager = canManageSurvey(req.user, survey);
  const open = isOpen(survey);
  if (!open && !manager) {
    return res.status(410).render('pages/survey-closed.njk', {
      title: `${survey.title} — опитування завершено`,
      survey
    });
  }

  const attempts = await SurveyResult.count({
    where: { survey_id: survey.id },
    distinct: true,
    col: 'session_id'
  });

  const locked = !req.user;
  const draft = locked || !open ? null : await getDraft(req.user.id, survey.id);
  const savedValues = draftValues(draft);
  const formValues = Object.keys(values).length > 0 ? values : savedValues;
  const anonymousChoice = survey.is_anonymous
    ? (Object.keys(values).length > 0
        ? values.is_anonymous === 'true' || values.is_anonymous === true
        : (draft?.payload?.anonymous ?? true))
    : false;

  return res.status(status).render('pages/survey.njk', {
    title: `${survey.title} — Kolo`,
    description: survey.description,
    survey,
    open,
    locked,
    preview: !open && manager,
    attempts,
    errors,
    values: formValues,
    anonymousChoice,
    draftRestored: Boolean(draft && Object.keys(savedValues).length > 0),
    message
  });
}

export async function getSurvey(req, res, next) {
  try {
    return await renderSurveyPage(req, res);
  } catch (error) {
    return next(error);
  }
}

export async function saveDraft(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: 'Увійдіть, щоб продовжити.' });
    }

    const survey = await Survey.findByPk(req.params.id, {
      include: [{ model: Question, as: 'questions', attributes: ['id'] }]
    });
    if (!survey) return res.status(404).json({ ok: false, message: 'Опитування не знайдено.' });
    if (!isOpen(survey)) return res.status(409).json({ ok: false, message: 'Опитування вже не приймає відповіді.' });

    const allowed = new Set((survey.questions || []).map((question) => `q_${question.id}`));
    const body = req.body || {};
    const values = {};

    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key)) continue;
      values[key] = Array.isArray(value)
        ? value.map((item) => String(item).trim().slice(0, 4000))
        : String(value).trim().slice(0, 4000);
    }

    await saveDraftRecord(req.user.id, survey.id, {
      values,
      anonymous: Boolean(survey.is_anonymous && body.is_anonymous === 'true')
    });

    return res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    return next(error);
  }
}

export async function submitSurvey(req, res, next) {
  try {
    if (!req.user) {
      if (req.wantsJson) {
        return res.status(401).json({ ok: false, message: 'Увійдіть, щоб пройти опитування.' });
      }
      return res.redirect(`/login?returnTo=${encodeURIComponent(`/surveys/${req.params.id}`)}`);
    }

    const survey = await loadSurveyBundle(req.params.id);
    if (!survey) {
      return res.status(404).json({ ok: false, message: 'Опитування не знайдено.' });
    }
    if (!isOpen(survey)) {
      return res.status(409).json({ ok: false, message: 'Опитування вже не приймає відповіді.' });
    }

    const { errors, answers } = validateAnswers(survey.questions, req.body);
    if (Object.keys(errors).length > 0) {
      if (req.wantsJson) {
        return res.status(422).json({
          ok: false,
          message: 'Перевірте відповіді у виділених питаннях.',
          errors
        });
      }
      return await renderSurveyPage(req, res, {
        status: 422,
        errors,
        values: req.body,
        message: 'Перевірте відповіді у виділених питаннях.'
      });
    }

    const anonymous = Boolean(
      survey.is_anonymous && (req.body.is_anonymous === 'true' || req.body.is_anonymous === true)
    );
    const sessionId = `${req.sessionID || 'session'}_${crypto.randomBytes(4).toString('hex')}`;
    const userId = anonymous ? null : req.user.id;
    const answeredAt = new Date();

    const rows = answers.map((answer) => ({
      survey_id: survey.id,
      question_id: answer.question.id,
      option_id: answer.option_id || null,
      user_id: userId,
      text_answer: answer.text_answer || null,
      rating_value: answer.rating_value || null,
      session_id: sessionId,
      is_anonymous: anonymous,
      answered_at: answeredAt
    }));

    await SurveyResult.bulkCreate(rows);
    await deleteDraft(req.user.id, survey.id).catch(() => {});

    if (!req.wantsJson) {
      return res.redirect(`/surveys?ok=${encodeURIComponent('Відповіді прийнято. Дякуємо!')}`);
    }

    const html = await renderView(res, 'partials/survey-thanks.njk', {
      survey,
      anonymous,
      answeredAt
    });

    return res.json({ ok: true, message: 'Відповіді прийнято. Дякуємо!', html });
  } catch (error) {
    return next(error);
  }
}

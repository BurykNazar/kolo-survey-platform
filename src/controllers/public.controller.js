import crypto from 'crypto';
import {
  Survey,
  SurveyCategory,
  Question,
  SurveyResult
} from '../db/models.js';
import { activeSurveyWhere, canManageSurvey, isOpen, loadSurveyBundle, attemptsBySurvey, categoryCounts } from '../services/surveys.js';
import { totalsFor } from '../services/stats.js';
import { validateAnswers } from '../lib/validation.js';

function renderView(res, view, data) {
  return new Promise((resolve, reject) => {
    res.render(view, data, (error, html) => (error ? reject(error) : resolve(html)));
  });
}

export async function getLanding(req, res, next) {
  try {
    const surveys = await Survey.findAll({
      where: activeSurveyWhere(),
      include: [
        { model: SurveyCategory, as: 'category' },
        { model: Question, as: 'questions', attributes: ['id', 'question_text', 'question_type', 'order_num', 'hint'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const ids = surveys.map((survey) => survey.id);
    const attempts = await attemptsBySurvey(ids);
    const counts = Object.fromEntries(surveys.map((survey) => [survey.id, attempts.get(survey.id) || 0]));
    const totals = await totalsFor(ids);
    const categories = await categoryCounts();

    const ranked = [...surveys].sort((a, b) => (attempts.get(b.id) || 0) - (attempts.get(a.id) || 0));
    const featured = ranked.slice(0, 3);

    const showcase = ranked.find((survey) => survey.questions.some((question) => question.question_type === 'rating')) || ranked[0] || null;
    let showcaseQuestion = null;
    if (showcase) {
      showcaseQuestion =
        showcase.questions.find((question) => question.question_type === 'rating') || showcase.questions[0] || null;
    }

    return res.render('pages/landing.njk', {
      title: 'Kolo — опитування, які повертаються з відповідями',
      description:
        'Kolo збирає відповіді команди, клієнтів і громади в одному місці: питання, учасники, результати та висновки.',
      featured,
      attempts,
      counts,
      totals,
      categories,
      showcase,
      showcaseQuestion,
      activeCount: surveys.length
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCatalog(req, res, next) {
  try {
    const categoryCode = typeof req.query.category === 'string' ? req.query.category : '';
    const where = activeSurveyWhere();
    const include = [
      { model: SurveyCategory, as: 'category' },
      { model: Question, as: 'questions', attributes: ['id'] }
    ];

    if (categoryCode) {
      include[0].where = { code: categoryCode };
      include[0].required = true;
    }

    const surveys = await Survey.findAll({
      where,
      include,
      order: [['created_at', 'DESC']]
    });

    const attempts = await attemptsBySurvey(surveys.map((survey) => survey.id));
    const counts = Object.fromEntries(surveys.map((survey) => [survey.id, attempts.get(survey.id) || 0]));
    const categories = await categoryCounts();
    const totalActive = categories.reduce((sum, category) => sum + Number(category.active_surveys || 0), 0);
    const totals = await totalsFor(surveys.map((survey) => survey.id));

    return res.render('pages/catalog.njk', {
      title: 'Опитування — Kolo',
      description: 'Активні опитування Kolo: оберіть тему та поділіться думкою.',
      surveys,
      attempts,
      counts,
      categories,
      totalActive,
      totals,
      activeCategory: categoryCode
    });
  } catch (error) {
    return next(error);
  }
}

async function renderSurveyPage(req, res, { status = 200, errors = {}, values = {}, message = '' } = {}) {
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

  const totalQuestions = survey.questions.length;
  const answered = survey.questions.filter((question) => question.is_required).length;

  return res.status(status).render('pages/survey.njk', {
    title: `${survey.title} — Kolo`,
    description: survey.description,
    survey,
    open,
    preview: !open && manager,
    attempts,
    totalQuestions,
    requiredCount: answered,
    errors,
    values,
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

export async function submitSurvey(req, res, next) {
  try {
    const survey = await loadSurveyBundle(req.params.id);
    if (!survey) {
      return res.status(404).json({ ok: false, message: 'Опитування не знайдено.' });
    }

    const manager = canManageSurvey(req.user, survey);
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
      survey.is_anonymous ||
        !req.user ||
        req.body.is_anonymous === 'true' ||
        req.body.is_anonymous === true ||
        manager
    );

    const sessionId = `${req.sessionID || `guest_${crypto.randomBytes(6).toString('hex')}`}_${crypto.randomBytes(4).toString('hex')}`;
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

    if (!req.wantsJson) {
      return res.redirect(`/surveys?ok=${encodeURIComponent('Відповіді прийнято. Дякуємо!')}`);
    }

    const html = await renderView(res, 'partials/survey-thanks.njk', {
      survey,
      anonymous,
      answeredAt
    });

    return res.json({
      ok: true,
      message: 'Відповіді прийнято. Дякуємо!',
      html
    });
  } catch (error) {
    return next(error);
  }
}

import { Op } from 'sequelize';
import { Survey, SurveyCategory, User } from '../../db/models.js';
import { attemptsBySurvey, categoryCounts } from '../../services/surveys.js';
import { parseId, validateSurveyInput } from '../../lib/validation.js';
import { done, reject, surveyCountsById, surveysForUser } from './shared.js';

// ── Список опитувань ─────────────────────────────────────────────────────────

export async function getSurveys(req, res, next) {
  try {
    const surveys = await surveysForUser(req.user);
    const attemptsMap = await attemptsBySurvey(surveys.map((survey) => survey.id));
    const categories = await categoryCounts();
    const creators =
      req.user.role === 'admin'
        ? await User.findAll({ where: { role: { [Op.in]: ['creator', 'admin'] } }, order: [['full_name', 'ASC']], raw: true })
        : [];

    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const filtered = status === 'all' ? surveys : surveys.filter((survey) => survey.status === status);

    return res.render('pages/surveys.njk', {
      title: 'Опитування — Kolo',
      surveys: filtered,
      allCount: surveys.length,
      counts: surveyCountsById(surveys, attemptsMap),
      categories,
      creators,
      activeStatus: status,
      statusTotals: {
        all: surveys.length,
        active: surveys.filter((survey) => survey.status === 'active').length,
        draft: surveys.filter((survey) => survey.status === 'draft').length,
        closed: surveys.filter((survey) => survey.status === 'closed').length
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function createSurvey(req, res, next) {
  try {
    const { errors, data } = validateSurveyInput(req.body);
    const category = data.category_id ? await SurveyCategory.findByPk(data.category_id) : null;
    if (!category) errors.category_id = 'Такої категорії немає.';

    let creatorId = req.user.id;
    if (req.user.role === 'admin' && req.body.creator_id) {
      const requested = await User.findOne({ where: { id: parseId(req.body.creator_id), is_active: true } });
      if (!requested) errors.creator_id = 'Оберіть автора зі списку.';
      else creatorId = requested.id;
    }

    if (Object.keys(errors).length > 0) {
      return reject(req, res, 422, 'Перевірте поля опитування.', errors);
    }

    const survey = await Survey.create({
      ...data,
      creator_id: creatorId,
      status: data.status || 'draft'
    });

    return done(req, res, {
      message: 'Опитування створено.',
      redirect: `/studio/surveys/${survey.id}`,
      surveyId: survey.id
    });
  } catch (error) {
    return next(error);
  }
}

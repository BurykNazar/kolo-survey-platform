import { Survey, SurveyCategory, Question, SurveyResult, User } from '../../db/models.js';
import {
  canManageSurvey,
  deleteSurveyCascade,
  loadSurveyBundle,
  syncOptions
} from '../../services/surveys.js';
import { parseId, validateSurveyInput } from '../../lib/validation.js';
import {
  canManageSurveyById,
  deny,
  done,
  questionPayload,
  reject
} from './shared.js';

export async function getBuilder(req, res, next) {
  try {
    const survey = await loadSurveyBundle(req.params.id);
    if (!survey) {
      return res.status(404).render('pages/error.njk', {
        status: 404,
        title: 'Опитування не знайдено',
        message: 'Можливо, його вже видалили.'
      });
    }
    if (!canManageSurvey(req.user, survey)) {
      return deny(req, res, 'Ви можете редагувати лише власні опитування.');
    }

    const attempts = await SurveyResult.count({
      where: { survey_id: survey.id },
      distinct: true,
      col: 'session_id'
    });
    const categories = await SurveyCategory.findAll({ order: [['name', 'ASC']] });

    return res.render('pages/builder.njk', {
      title: `${survey.title} — Kolo`,
      survey,
      questionData: questionPayload(survey.questions),
      categories,
      attempts,
      canCopy: req.user.role === 'admin',
      creators:
        req.user.role === 'admin'
          ? await User.findAll({ where: { role: 'creator', is_active: true }, order: [['full_name', 'ASC']], raw: true })
          : []
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateSurvey(req, res, next) {
  try {
    const survey = await canManageSurveyById(req.user, req.params.id);
    if (!survey) return deny(req, res, 'Ви можете редагувати лише власні опитування.');

    const { errors, data } = validateSurveyInput(req.body);
    const category = data.category_id ? await SurveyCategory.findByPk(data.category_id) : null;
    if (!category) errors.category_id = 'Такої категорії немає.';

    if (Object.keys(errors).length > 0) {
      return reject(req, res, 422, 'Перевірте поля опитування.', errors);
    }

    if (req.user.role === 'admin' && req.body.creator_id) {
      const creator = await User.findByPk(parseId(req.body.creator_id));
      if (creator) data.creator_id = creator.id;
    }

    await survey.update(data);
    return done(req, res, {
      message: 'Зміни збережено.',
      survey: {
        title: data.title,
        status: data.status,
        estimated_minutes: data.estimated_minutes,
        is_anonymous: data.is_anonymous
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateSurveyStatus(req, res, next) {
  try {
    const survey = await canManageSurveyById(req.user, req.params.id);
    if (!survey) return deny(req, res, 'Ви можете змінювати лише власні опитування.');

    const status = String(req.body.status || '');
    if (!['draft', 'active', 'closed'].includes(status)) {
      return reject(req, res, 422, 'Невідомий статус.');
    }

    await survey.update({ status });
    const labels = { draft: 'Чернетка', active: 'Активне', closed: 'Завершене' };
    return done(req, res, { message: `Статус: ${labels[status]}.`, status, label: labels[status] });
  } catch (error) {
    return next(error);
  }
}

export async function deleteSurvey(req, res, next) {
  try {
    const survey = await canManageSurveyById(req.user, req.params.id);
    if (!survey) return deny(req, res, 'Ви можете видаляти лише власні опитування.');

    await deleteSurveyCascade(survey.id);
    return done(req, res, {
      message: 'Опитування видалено разом із питаннями та відповідями.',
      redirect: '/studio/surveys',
      removedId: survey.id
    });
  } catch (error) {
    return next(error);
  }
}

export async function copySurvey(req, res, next) {
  try {
    if (req.user.role !== 'admin') return deny(req, res);

    const source = await loadSurveyBundle(req.params.id);
    if (!source) return reject(req, res, 404, 'Вихідне опитування не знайдено.');

    const creator = await User.findOne({ where: { id: parseId(req.body.creator_id), is_active: true } });
    if (!creator) return reject(req, res, 422, 'Оберіть автора для копії.', { creator_id: 'Оберіть автора.' });

    const copy = await Survey.create({
      category_id: source.category_id,
      creator_id: creator.id,
      title: String(req.body.title || `Копія — ${source.title}`).trim().slice(0, 255),
      description: source.description,
      status: 'draft',
      estimated_minutes: source.estimated_minutes,
      is_anonymous: source.is_anonymous,
      expires_at: null
    });

    for (const question of source.questions) {
      const created = await Question.create({
        survey_id: copy.id,
        question_text: question.question_text,
        question_type: question.question_type,
        order_num: question.order_num,
        is_required: question.is_required,
        hint: question.hint
      });
      for (const option of question.options) {
        await syncOptions(created.id, [option.option_text]);
      }
    }

    return done(req, res, {
      message: `Копію створено для ${creator.full_name}.`,
      redirect: `/studio/surveys/${copy.id}`
    });
  } catch (error) {
    return next(error);
  }
}

import {
  Survey,
  SurveyCategory,
  Question
} from '../db/models.js';
import { activeSurveyWhere, attemptsBySurvey, categoryCounts } from '../services/surveys.js';
import { totalsFor } from '../services/stats.js';

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

    const ratingCandidates = ranked.filter((survey) =>
      survey.questions.some((question) => question.question_type === 'rating')
    );
    const showcase = ratingCandidates.length
      ? ratingCandidates[Math.floor(Math.random() * ratingCandidates.length)]
      : null;
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

import { Op } from 'sequelize';
import { Survey, SurveyResult } from '../../db/models.js';
import { canManageSurvey } from '../../services/surveys.js';
import { parseId } from '../../lib/validation.js';
import { apiData, apiError } from './shared.js';

export async function apiListResults(req, res, next) {
  try {
    const where = {};
    let ownSurveyIds = null;

    if (req.user.role === 'creator') {
      const surveys = await Survey.findAll({ where: { creator_id: req.user.id }, attributes: ['id'], raw: true });
      ownSurveyIds = surveys.map((row) => row.id);
      where.survey_id = { [Op.in]: ownSurveyIds };
    } else if (req.user.role === 'visitor') {
      where.user_id = req.user.id;
    }

    if (req.query.survey_id) {
      const requested = parseId(req.query.survey_id);
      if (!requested) return apiError(res, 422, 'Некоректний survey_id.');
      if (ownSurveyIds && !ownSurveyIds.includes(requested)) {
        return apiError(res, 403, 'Це опитування належить іншому авторові.');
      }
      where.survey_id = requested;
    }

    const results = await SurveyResult.findAll({ where, order: [['answered_at', 'DESC']], limit: 500 });
    return apiData(res, results);
  } catch (error) {
    return next(error);
  }
}

export async function apiDeleteResult(req, res, next) {
  try {
    const result = await SurveyResult.findByPk(req.params.id);
    if (!result) return apiError(res, 404, 'Відповідь не знайдено.');
    const survey = await Survey.findByPk(result.survey_id);
    if (!canManageSurvey(req.user, survey)) return apiError(res, 403, 'Недостатньо прав.');
    await result.destroy();
    return apiData(res, { removed: result.id });
  } catch (error) {
    return next(error);
  }
}

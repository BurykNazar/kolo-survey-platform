import { Survey, SurveyResult } from '../../db/models.js';
import { totalsFor } from '../../services/stats.js';

// ── Профіль ──────────────────────────────────────────────────────────────────

export { changePassword, updateProfile } from '../auth.controller.js';

export async function getProfile(req, res, next) {
  try {
    const surveyIds =
      req.user.role === 'creator'
        ? (await Survey.findAll({ where: { creator_id: req.user.id }, attributes: ['id'] })).map((row) => row.id)
        : [];

    const totals = req.user.role === 'creator' ? await totalsFor(surveyIds) : { attempts: 0, answers: 0 };
    const ownResponses = await SurveyResult.count({ where: { user_id: req.user.id }, distinct: true, col: 'session_id' });

    return res.render('pages/profile.njk', {
      title: 'Профіль — Kolo',
      profileUser: req.user,
      totals,
      ownResponses,
      surveyCount: surveyIds.length
    });
  } catch (error) {
    return next(error);
  }
}

import { SurveyDraft } from '../db/models.js';

export async function getDraft(userId, surveyId) {
  if (!userId || !surveyId) return null;
  return SurveyDraft.findOne({ where: { user_id: userId, survey_id: surveyId } });
}

export async function saveDraft(userId, surveyId, payload) {
  const [row] = await SurveyDraft.upsert(
    {
      user_id: userId,
      survey_id: surveyId,
      payload,
      updated_at: new Date()
    },
    { returning: true }
  );
  return row;
}

export async function deleteDraft(userId, surveyId) {
  return SurveyDraft.destroy({ where: { user_id: userId, survey_id: surveyId } });
}

export async function deleteDraftsForSurvey(surveyId) {
  return SurveyDraft.destroy({ where: { survey_id: surveyId } });
}

export async function deleteDraftsForUser(userId) {
  return SurveyDraft.destroy({ where: { user_id: userId } });
}

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  getOverview,
  getSurveys,
  createSurvey,
  getBuilder,
  updateSurvey,
  updateSurveyStatus,
  deleteSurvey,
  copySurvey,
  createQuestion,
  updateQuestion,
  removeQuestion,
  moveQuestion,
  getResponses,
  getResponseDetail,
  removeResponse,
  getCategories,
  createCategory,
  updateCategory,
  removeCategory,
  getPeople,
  createPerson,
  updatePerson,
  removePerson,
  getProfile,
  updateProfile,
  changePassword
} from '../controllers/studio.controller.js';

const router = Router();
const teamOnly = requireRole('admin', 'creator');
const adminOnly = requireRole('admin');

router.get('/', getOverview);

router.get('/surveys', teamOnly, getSurveys);
router.post('/surveys', teamOnly, createSurvey);
router.get('/surveys/:id', teamOnly, getBuilder);
router.post('/surveys/:id', teamOnly, updateSurvey);
router.post('/surveys/:id/status', teamOnly, updateSurveyStatus);
router.post('/surveys/:id/delete', teamOnly, deleteSurvey);
router.post('/surveys/:id/copy', adminOnly, copySurvey);

router.post('/surveys/:id/questions', teamOnly, createQuestion);
router.post('/questions/:id', teamOnly, updateQuestion);
router.post('/questions/:id/delete', teamOnly, removeQuestion);
router.post('/questions/:id/move', teamOnly, moveQuestion);

router.get('/responses', getResponses);
router.get('/responses/:surveyId/:sessionId', getResponseDetail);
router.post('/responses/delete', teamOnly, removeResponse);

router.get('/categories', adminOnly, getCategories);
router.post('/categories', adminOnly, createCategory);
router.post('/categories/:id', adminOnly, updateCategory);
router.post('/categories/:id/delete', adminOnly, removeCategory);

router.get('/people', adminOnly, getPeople);
router.post('/people', adminOnly, createPerson);
router.post('/people/:id', adminOnly, updatePerson);
router.post('/people/:id/delete', adminOnly, removePerson);

router.get('/profile', getProfile);
router.post('/profile', updateProfile);
router.post('/profile/password', changePassword);

export default router;

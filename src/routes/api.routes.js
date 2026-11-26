import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { submitSurvey } from '../controllers/public.controller.js';
import {
  apiLogin,
  apiMe,
  apiListSurveys,
  apiGetSurvey,
  apiCreateSurvey,
  apiUpdateSurvey,
  apiDeleteSurvey,
  apiListCategories,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  apiListUsers,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser,
  apiListQuestions,
  apiCreateQuestion,
  apiUpdateQuestion,
  apiDeleteQuestion,
  apiListOptions,
  apiCreateOption,
  apiUpdateOption,
  apiDeleteOption,
  apiListResults,
  apiDeleteResult
} from '../controllers/api.controller.js';

const router = Router();

function sessionCsrf(req, res, next) {
  const token = req.get('x-csrf-token');
  if (!req.session?.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ ok: false, message: 'Оновіть сторінку та спробуйте ще раз.' });
  }
  return next();
}

router.post('/auth/login', apiLogin);
router.get('/auth/me', authenticateJWT, apiMe);
router.post('/surveys/:id/responses', sessionCsrf, submitSurvey);

router.use(authenticateJWT);

router.get('/surveys', apiListSurveys);
router.post('/surveys', apiCreateSurvey);
router.get('/surveys/:id', apiGetSurvey);
router.put('/surveys/:id', apiUpdateSurvey);
router.delete('/surveys/:id', apiDeleteSurvey);

router.get('/categories', apiListCategories);
router.post('/categories', apiCreateCategory);
router.put('/categories/:id', apiUpdateCategory);
router.delete('/categories/:id', apiDeleteCategory);

router.get('/users', apiListUsers);
router.post('/users', apiCreateUser);
router.put('/users/:id', apiUpdateUser);
router.delete('/users/:id', apiDeleteUser);

router.get('/questions', apiListQuestions);
router.post('/questions', apiCreateQuestion);
router.put('/questions/:id', apiUpdateQuestion);
router.delete('/questions/:id', apiDeleteQuestion);

router.get('/options', apiListOptions);
router.post('/options', apiCreateOption);
router.put('/options/:id', apiUpdateOption);
router.delete('/options/:id', apiDeleteOption);

router.get('/results', apiListResults);
router.delete('/results/:id', apiDeleteResult);

export default router;

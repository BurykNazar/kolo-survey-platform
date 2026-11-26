import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { getLanding, getCatalog } from '../controllers/public.controller.js';
import { getSurvey, saveDraft, submitSurvey } from '../controllers/survey-take.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const responseLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { ok: false, message: 'Забагато спроб. Зачекайте хвилину.' }
});

router.get('/', getLanding);
router.get('/surveys', getCatalog);
router.get('/surveys/:id', getSurvey);
router.post('/surveys/:id/draft', requireAuth, saveDraft);
router.post('/surveys/:id/responses', responseLimiter, submitSurvey);

export default router;

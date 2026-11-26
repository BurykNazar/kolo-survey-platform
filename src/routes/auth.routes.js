import { Router } from 'express';
import { getLogin, postLogin, getRegister, postRegister, postLogout } from '../controllers/auth.controller.js';
import { guestOnly, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/login', guestOnly, getLogin);
router.post('/login', guestOnly, postLogin);
router.get('/register', guestOnly, getRegister);
router.post('/register', guestOnly, postRegister);
router.post('/logout', requireAuth, postLogout);

export default router;

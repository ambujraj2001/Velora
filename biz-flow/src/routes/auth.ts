import { Router } from 'express';
import { getMe, handleGoogleCallback, logout, startGoogleLogin } from '../controllers/authController';

const router = Router();

router.get('/google/start', startGoogleLogin);
router.get('/google/callback', handleGoogleCallback);
router.get('/me', getMe);
router.get('/logout', logout);
router.post('/logout', logout);

export default router;

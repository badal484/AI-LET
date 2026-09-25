import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import {
  authRateLimiter,
  passwordResetRateLimiter,
  tokenRefreshRateLimiter,
} from '../../shared/middleware/securityRateLimiter.js';
import {
  registerRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  logoutRequestSchema,
  verifyEmailRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
} from '@ai-companion/validation';

const router = Router();

// Public Authentication Endpoints
router.post(
  '/register',
  authRateLimiter,
  validateRequest(registerRequestSchema),
  AuthController.register,
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginRequestSchema),
  AuthController.login,
);

router.post(
  '/refresh',
  tokenRefreshRateLimiter,
  validateRequest(refreshTokenRequestSchema),
  AuthController.refresh,
);

router.post(
  '/verify-email',
  passwordResetRateLimiter,
  validateRequest(verifyEmailRequestSchema),
  AuthController.verifyEmail,
);

router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validateRequest(forgotPasswordRequestSchema),
  AuthController.forgotPassword,
);

router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validateRequest(resetPasswordRequestSchema),
  AuthController.resetPassword,
);

// Authenticated Endpoints
router.get('/me', authenticateUser, AuthController.getMe);
router.post('/logout', authenticateUser, validateRequest(logoutRequestSchema), AuthController.logout);
router.post('/logout-all', authenticateUser, AuthController.logoutAll);
router.get('/sessions', authenticateUser, AuthController.getSessions);
router.delete('/sessions/:sessionId', authenticateUser, AuthController.revokeSession);

export const authRouter: Router = router;

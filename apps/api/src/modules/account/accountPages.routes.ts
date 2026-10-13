import express, { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { resetPasswordRequestSchema } from '@ai-companion/validation';
import { AuthService } from '../auth/auth.service.js';
import { rateLimitStore } from '../../shared/middleware/rateLimitStore.js';
import { esc, page } from '../legal/legal.routes.js';

/**
 * Account pages opened from emails, served by the API so the link works on any phone (no app update needed):
 *   /account/reset-password?token=…   set a new password (link from the "forgot password" email)
 * The token is checked by AuthService.resetPassword (one use, 1 hour); success signs out every device.
 */
export const accountPagesRouter: Router = Router();

// The page URL carries a one-time token: never cache it or send it on in a Referer.
accountPagesRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const resetForm = (token: string, notice = '') =>
  page(
    'Set a new password',
    `${notice}
<form method="post" action="/account/reset-password" class="box">
<input type="hidden" name="token" value="${esc(token)}">
<label for="pw">New password</label>
<input id="pw" name="newPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
<label for="pw2">Type it again</label>
<input id="pw2" name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
<button type="submit">Save new password</button>
</form>
<p class="muted">After saving, you're signed out on every phone. Open Lovira and sign in with the new password.</p>`,
  );

const message = (title: string, text: string) => page(title, `<div class="box">${text}</div>`);

accountPagesRouter.get('/reset-password', (req: Request, res: Response) => {
  const token = String(req.query['token'] ?? '').slice(0, 200);
  if (!token) {
    res.status(400).type('html').send(message('Link not complete', 'This link is missing a part. Open the newest reset email again, or ask for a new one in the app (Sign in → Forgot?).'));
    return;
  }
  res.type('html').send(resetForm(token));
});

accountPagesRouter.post(
  '/reset-password',
  express.urlencoded({ extended: false, limit: '8kb' }),
  rateLimit({ windowMs: 15 * 60_000, max: 10, store: rateLimitStore('account-reset'), passOnStoreError: true, standardHeaders: true, legacyHeaders: false }),
  async (req: Request, res: Response) => {
    const token = String(req.body?.token ?? '').slice(0, 200);
    const newPassword = String(req.body?.newPassword ?? '');
    if (newPassword !== String(req.body?.confirm ?? '')) {
      res.status(400).type('html').send(resetForm(token, `<p><b>The two passwords don't match.</b> Please type them again.</p>`));
      return;
    }
    const parsed = resetPasswordRequestSchema.safeParse({ token, newPassword });
    if (!parsed.success) {
      const why = parsed.error.issues.find((i) => i.path[0] === 'newPassword')?.message ?? 'Please choose another password.';
      res.status(400).type('html').send(resetForm(token, `<p><b>${esc(why)}</b></p>`));
      return;
    }
    try {
      await AuthService.resetPassword(parsed.data, req.ip, req.headers['user-agent']);
      res.type('html').send(message('Password changed', '<b>Done — your password is changed.</b> Open Lovira and sign in with your new password.'));
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status && status < 500) {
        const weak = /password/i.test((err as Error).message) && !/token/i.test((err as Error).message);
        res.status(400).type('html').send(
          weak
            ? resetForm(token, `<p><b>${esc((err as Error).message)}</b></p>`)
            : message('Link expired', 'This link has expired or was already used. In the app, go to <b>Sign in → Forgot?</b> to get a new one.'),
        );
        return;
      }
      res.status(500).type('html').send(message('Something went wrong', 'We couldn\'t change your password just now. Please try again in a few minutes.'));
    }
  },
);

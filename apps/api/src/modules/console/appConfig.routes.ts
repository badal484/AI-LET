import { Router } from 'express';
import { getSetting } from './appSettings.js';

/**
 * GET /api/v1/app/config — no login needed. The app reads it on start and when it comes back to the
 * foreground: the announcement banner, the minimum app version (older apps are asked to update) and
 * maintenance mode. All three are set in the admin console → Settings.
 */
export const appConfigRouter: Router = Router();

appConfigRouter.get('/config', async (_req, res, next) => {
  try {
    const [annOn, annText, minVersion, maintenance, maintenanceMessage] = await Promise.all([
      getSetting('announcement.enabled'),
      getSetting('announcement.text'),
      getSetting('app.minVersion'),
      getSetting('maintenance.enabled'),
      getSetting('maintenance.message'),
    ]);
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({
      success: true,
      data: {
        announcement: annOn && annText.trim() ? { id: hash(annText), text: annText.trim() } : null,
        minVersion: minVersion || null,
        maintenance: maintenance ? { message: maintenanceMessage } : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** A short id for the text, so the app can remember "dismissed" per announcement. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

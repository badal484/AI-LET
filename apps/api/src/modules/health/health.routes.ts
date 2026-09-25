import { Router } from 'express';
import { HealthController } from './health.controller.js';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';

const router = Router();

// Public Health & Probe Endpoints
router.get('/', HealthController.getHealth);
router.get('/live', HealthController.getLiveness);
router.get('/ready', HealthController.getReadiness);
router.get('/metrics', HealthController.getPrometheusMetrics);

// Deep diagnostics expose host, queue and breaker internals: operators only.
const canRead = [authenticateAdmin, requirePermission(ADMIN_PERMISSIONS.SETTINGS_READ)];
router.get('/dependencies', ...canRead, HealthController.getDeepDiagnostics);

// Protected Admin Infrastructure & Reliability Controls — each action needs its own permission,
// not merely an admin session (a support or analyst admin must not flip global kill switches).
router.get('/admin/killswitches', ...canRead, HealthController.getKillSwitches);
router.post('/admin/killswitches', authenticateAdmin, requirePermission(ADMIN_PERMISSIONS.KILL_SWITCHES_WRITE), HealthController.updateKillSwitch);
router.get('/admin/circuit-breakers', ...canRead, HealthController.getCircuitBreakers);
router.post('/admin/circuit-breakers/reset', authenticateAdmin, requirePermission(ADMIN_PERMISSIONS.SETTINGS_WRITE), HealthController.resetCircuitBreakers);
router.get('/admin/dlq', ...canRead, HealthController.getDeadLetterJobs);
router.post('/admin/dlq/:jobId/retry', authenticateAdmin, requirePermission(ADMIN_PERMISSIONS.SETTINGS_WRITE), HealthController.retryDeadLetterJob);

export const healthRoutes: Router = router;

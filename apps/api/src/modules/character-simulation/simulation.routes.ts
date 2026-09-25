import { Router } from 'express';
import { ADMIN_PERMISSIONS } from '@ai-companion/config';
import { SimulationController, resolveAdminSimulationSubject } from './simulation.controller.js';
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import { authenticateAdmin, requirePermission } from '../../shared/middleware/adminAuth.middleware.js';

const router: Router = Router();

// Every user simulation endpoint acts on the authenticated caller's own data only.
router.use(authenticateUser);

// Continuity & Context Pack
router.get('/continuity/:characterId', SimulationController.getContinuity);
router.get('/context-pack/:characterId', SimulationController.getContextPack);

// User Simulation Settings & Reset
router.get('/settings/:characterId', SimulationController.getSettings);
router.patch('/settings/:characterId', SimulationController.updateSettings);
router.post('/reset/:characterId', SimulationController.resetState);

// Character Goals
router.get('/goals/:characterId', SimulationController.listGoals);
router.post('/goals', SimulationController.createGoal);
router.patch('/goals/:goalId', SimulationController.updateGoal);
router.delete('/goals/:goalId', SimulationController.deleteGoal);

// Character Plans
router.get('/plans/:characterId', SimulationController.listPlans);
router.post('/plans', SimulationController.createPlan);
router.patch('/plans/:planId/steps/:stepId', SimulationController.updatePlanStep);
router.patch('/plans/:planId/status', SimulationController.setPlanStatus);

// Conversational Threads
router.get('/threads/:characterId', SimulationController.listThreads);
router.post('/threads/:threadId/resolve', SimulationController.resolveThread);

// Commitments
router.get('/commitments/:characterId', SimulationController.listCommitments);

// World State
router.get('/world-state/:characterId', SimulationController.listWorldState);
router.post('/world-state', SimulationController.setWorldState);
router.get('/world-state/:characterId/events', SimulationController.listWorldEvents);

// Routines
router.get('/routines/:characterId', SimulationController.listRoutines);
// Routines are character-global configuration, so creating one is an operator action (see the
// admin router) — never something one end user can do to a character everyone talks to.

export { router as simulationRouter };

// Operator endpoints (execution, run history, replay, version migration) — admin only.
const adminRouter: Router = Router();
adminRouter.use(authenticateAdmin);
adminRouter.post('/run', requirePermission(ADMIN_PERMISSIONS.SIMULATION_OPERATE), SimulationController.runSimulation);
adminRouter.get('/runs', requirePermission(ADMIN_PERMISSIONS.SIMULATION_READ), SimulationController.listSimulationRuns);
adminRouter.post('/replay/:runId', requirePermission(ADMIN_PERMISSIONS.SIMULATION_OPERATE), SimulationController.replayRun);
adminRouter.post('/migrate', requirePermission(ADMIN_PERMISSIONS.SIMULATION_OPERATE), SimulationController.migrateVersion);

// Operator inspection of a specific user's simulation state. The target user is explicit
// (`?userId=` / `body.userId`), validated, and every mutation is audited.
const read = [requirePermission(ADMIN_PERMISSIONS.SIMULATION_READ), resolveAdminSimulationSubject(true)];
const operate = [requirePermission(ADMIN_PERMISSIONS.SIMULATION_OPERATE), resolveAdminSimulationSubject(true)];
adminRouter.get('/users/continuity/:characterId', ...read, SimulationController.getContinuity);
adminRouter.get('/users/context-pack/:characterId', ...read, SimulationController.getContextPack);
adminRouter.get('/users/settings/:characterId', ...read, SimulationController.getSettings);
adminRouter.patch('/users/settings/:characterId', ...operate, SimulationController.updateSettings);
adminRouter.post('/users/reset/:characterId', ...operate, SimulationController.resetState);
adminRouter.get('/users/goals/:characterId', ...read, SimulationController.listGoals);
adminRouter.post('/users/goals', ...operate, SimulationController.createGoal);
adminRouter.get('/users/plans/:characterId', ...read, SimulationController.listPlans);
adminRouter.post('/users/plans', ...operate, SimulationController.createPlan);
adminRouter.get('/routines/:characterId', requirePermission(ADMIN_PERMISSIONS.SIMULATION_READ), SimulationController.listRoutines);
adminRouter.post('/routines', requirePermission(ADMIN_PERMISSIONS.SIMULATION_OPERATE), resolveAdminSimulationSubject(false), SimulationController.createRoutine);
adminRouter.get('/users/threads/:characterId', ...read, SimulationController.listThreads);
adminRouter.get('/users/commitments/:characterId', ...read, SimulationController.listCommitments);
// World state can be character-global, so the target user is optional here.
adminRouter.get('/world-state/:characterId', requirePermission(ADMIN_PERMISSIONS.SIMULATION_READ), resolveAdminSimulationSubject(false), SimulationController.listWorldState);
adminRouter.get('/world-state/:characterId/events', requirePermission(ADMIN_PERMISSIONS.SIMULATION_READ), resolveAdminSimulationSubject(false), SimulationController.listWorldEvents);
adminRouter.post('/world-state', requirePermission(ADMIN_PERMISSIONS.SIMULATION_OPERATE), resolveAdminSimulationSubject(false), SimulationController.setWorldState);

export { adminRouter as adminSimulationRouter };

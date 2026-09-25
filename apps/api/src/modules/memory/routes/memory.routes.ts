import { Router } from 'express';
import { MemoryController } from '../controllers/memory.controller.js';
import { authenticateUser } from '../../../shared/middleware/auth.middleware.js';

export const memoryRouter: Router = Router();

// All memory endpoints require active user authentication
memoryRouter.use(authenticateUser);

// User Memory Settings
memoryRouter.get('/settings', MemoryController.getSettings);
memoryRouter.patch('/settings', MemoryController.updateSettings);

// Memory Collection & Wipe
memoryRouter.get('/', MemoryController.listMemories);
memoryRouter.delete('/', MemoryController.forgetAllMemories);

// Individual Memory CRUD
memoryRouter.get('/:id', MemoryController.getMemory);
memoryRouter.patch('/:id', MemoryController.updateMemory);
memoryRouter.delete('/:id', MemoryController.deleteMemory);

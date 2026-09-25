import { Router } from 'express';
import { HomeController } from '../controllers/home.controller.js';
import { optionalAuth } from '../../../shared/middleware/auth.middleware.js';

export const homeRouter: Router = Router();

// GET /api/v1/home (Supports both authenticated users with active relationships and guest cold-start discovery)
homeRouter.get('/', optionalAuth, HomeController.getHomeFeed);

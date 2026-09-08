import { Router } from 'express';
import { budgetsController } from '../controllers/budgets.controller';
import { authenticate } from '../middleware/auth';

export const budgetsRouter = Router();

budgetsRouter.use(authenticate);

budgetsRouter.get('/', budgetsController.getAll);
budgetsRouter.put('/', budgetsController.upsertAll);

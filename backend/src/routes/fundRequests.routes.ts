import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { fundRequestsController } from '../controllers/fundRequests.controller';

export const fundRequestsRouter = Router();

fundRequestsRouter.use(authenticate, requireAddon('manajemen-dana'));

fundRequestsRouter.get('/',                       fundRequestsController.getAll);
fundRequestsRouter.post('/',                      fundRequestsController.create);
fundRequestsRouter.patch('/:id/approve',          fundRequestsController.approve);
fundRequestsRouter.patch('/:id/reject',           fundRequestsController.reject);
fundRequestsRouter.patch('/:id/realize',          fundRequestsController.realize);

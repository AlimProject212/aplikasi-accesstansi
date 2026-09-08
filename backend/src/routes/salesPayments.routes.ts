import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { salesPaymentsController } from '../controllers/salesPayments.controller';

export const salesPaymentsRouter = Router();

salesPaymentsRouter.use(authenticate, requireAddon('persediaan-dagang'));

salesPaymentsRouter.get('/',  salesPaymentsController.getAll);
salesPaymentsRouter.post('/', salesPaymentsController.create);

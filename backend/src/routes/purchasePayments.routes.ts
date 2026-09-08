import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { purchasePaymentsController } from '../controllers/purchasePayments.controller';

export const purchasePaymentsRouter = Router();

purchasePaymentsRouter.use(authenticate, requireAddon('persediaan-dagang'));

purchasePaymentsRouter.get('/',  purchasePaymentsController.getAll);
purchasePaymentsRouter.post('/', purchasePaymentsController.create);

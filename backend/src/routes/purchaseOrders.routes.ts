import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { purchaseOrdersController } from '../controllers/purchaseOrders.controller';

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.use(authenticate, requireAddon('persediaan-dagang'));

purchaseOrdersRouter.get('/',        purchaseOrdersController.getAll);
purchaseOrdersRouter.get('/:id',     purchaseOrdersController.getById);
purchaseOrdersRouter.post('/',       purchaseOrdersController.create);
purchaseOrdersRouter.put('/:id',     purchaseOrdersController.update);
purchaseOrdersRouter.put('/:id/status', purchaseOrdersController.updateStatus);
purchaseOrdersRouter.delete('/:id',  purchaseOrdersController.delete);

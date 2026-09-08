import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { stockAdjustmentsController } from '../controllers/stockAdjustments.controller';

export const stockAdjustmentsRouter = Router();

stockAdjustmentsRouter.use(authenticate, requireAddon('persediaan-dagang'));

stockAdjustmentsRouter.get('/',        stockAdjustmentsController.getAll);
stockAdjustmentsRouter.get('/:id',     stockAdjustmentsController.getById);
stockAdjustmentsRouter.post('/',       stockAdjustmentsController.create);
stockAdjustmentsRouter.post('/:id/post', stockAdjustmentsController.post);
stockAdjustmentsRouter.delete('/:id',  stockAdjustmentsController.delete);

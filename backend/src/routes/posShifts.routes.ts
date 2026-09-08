import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { posShiftsController } from '../controllers/posShifts.controller';

export const posShiftsRouter = Router();

posShiftsRouter.use(authenticate, requireAddon('persediaan-dagang'));

posShiftsRouter.get('/current',   posShiftsController.getCurrent);
posShiftsRouter.get('/',          posShiftsController.getAll);
posShiftsRouter.post('/',         posShiftsController.open);
posShiftsRouter.post('/:id/close', posShiftsController.close);

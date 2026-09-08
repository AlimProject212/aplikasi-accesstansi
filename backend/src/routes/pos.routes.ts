import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { posController } from '../controllers/pos.controller';

export const posRouter = Router();

posRouter.use(authenticate, requireAddon('persediaan-dagang'));

posRouter.get('/',            posController.getAll);
posRouter.get('/:id',         posController.getById);
posRouter.post('/checkout',   posController.checkout);
posRouter.post('/:id/void',   requireRole('SUPERADMIN', 'ADMIN', 'SUPERVISOR'), posController.void);

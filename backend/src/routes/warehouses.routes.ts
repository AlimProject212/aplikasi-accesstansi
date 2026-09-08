import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { warehousesController } from '../controllers/warehouses.controller';

export const warehousesRouter = Router();

warehousesRouter.use(authenticate, requireAddon('persediaan-dagang'));

warehousesRouter.get('/',    warehousesController.getAll);
warehousesRouter.post('/',   warehousesController.create);
warehousesRouter.put('/:id', warehousesController.update);
warehousesRouter.delete('/:id', warehousesController.delete);

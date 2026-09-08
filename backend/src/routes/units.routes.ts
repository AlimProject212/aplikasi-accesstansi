import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { unitsController } from '../controllers/units.controller';

export const unitsRouter = Router();

unitsRouter.use(authenticate, requireAddon('persediaan-dagang'));

unitsRouter.get('/',    unitsController.getAll);
unitsRouter.post('/',   unitsController.create);
unitsRouter.put('/:id', unitsController.update);
unitsRouter.delete('/:id', unitsController.delete);

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { inventorySettingsController } from '../controllers/inventorySettings.controller';

export const inventorySettingsRouter = Router();

inventorySettingsRouter.use(authenticate, requireAddon('persediaan-dagang'));

inventorySettingsRouter.get('/',  inventorySettingsController.get);
inventorySettingsRouter.put('/',  inventorySettingsController.update);

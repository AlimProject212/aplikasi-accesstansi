import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { inventoryController } from '../controllers/inventory.controller';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate, requireAddon('persediaan-dagang'));

inventoryRouter.get('/stock-card/:productId', inventoryController.getStockCard);
inventoryRouter.get('/valuation',             inventoryController.getValuation);
inventoryRouter.get('/low-stock',             inventoryController.getLowStock);
inventoryRouter.get('/gross-margin',          inventoryController.getGrossMargin);

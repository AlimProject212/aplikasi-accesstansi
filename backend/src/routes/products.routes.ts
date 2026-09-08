import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { productsController } from '../controllers/products.controller';

export const productsRouter = Router();

productsRouter.use(authenticate, requireAddon('persediaan-dagang'));

productsRouter.get('/',     productsController.getAll);
productsRouter.get('/:id',  productsController.getById);
productsRouter.post('/',    productsController.create);
productsRouter.put('/:id',  productsController.update);
productsRouter.delete('/:id', productsController.delete);

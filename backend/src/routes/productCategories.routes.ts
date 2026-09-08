import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { productCategoriesController } from '../controllers/productCategories.controller';

export const productCategoriesRouter = Router();

productCategoriesRouter.use(authenticate, requireAddon('persediaan-dagang'));

productCategoriesRouter.get('/',    productCategoriesController.getAll);
productCategoriesRouter.post('/',   productCategoriesController.create);
productCategoriesRouter.put('/:id', productCategoriesController.update);
productCategoriesRouter.delete('/:id', productCategoriesController.delete);

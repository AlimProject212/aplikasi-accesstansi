import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { docCategoriesController } from '../controllers/docCategories.controller';

export const docCategoriesRouter = Router();

docCategoriesRouter.use(authenticate, requireAddon('repository-dokumen'));

docCategoriesRouter.get('/',    docCategoriesController.getAll);
docCategoriesRouter.post('/',   docCategoriesController.create);
docCategoriesRouter.put('/:id', docCategoriesController.update);
docCategoriesRouter.delete('/:id', docCategoriesController.delete);

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { salesInvoicesController } from '../controllers/salesInvoices.controller';

export const salesInvoicesRouter = Router();

salesInvoicesRouter.use(authenticate, requireAddon('persediaan-dagang'));

salesInvoicesRouter.get('/',       salesInvoicesController.getAll);
salesInvoicesRouter.get('/:id',    salesInvoicesController.getById);
salesInvoicesRouter.post('/',      salesInvoicesController.create);
salesInvoicesRouter.post('/:id/post', salesInvoicesController.post);
salesInvoicesRouter.delete('/:id', salesInvoicesController.delete);

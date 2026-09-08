import { Router } from 'express';
import { journalsController } from '../controllers/journals.controller';
import { authenticate, requireRole } from '../middleware/auth';

export const journalsRouter = Router();

journalsRouter.use(authenticate);

journalsRouter.get('/', journalsController.getAll);
journalsRouter.post('/', journalsController.create);
journalsRouter.post('/bulk-delete', requireRole('SUPERADMIN'), journalsController.bulkDelete);
journalsRouter.get('/:id', journalsController.getById);
journalsRouter.put('/:id', journalsController.update);
journalsRouter.delete('/:id', requireRole('SUPERADMIN'), journalsController.delete);
journalsRouter.patch('/:id/status', journalsController.updateStatus);
journalsRouter.patch('/:id/attachment', journalsController.updateAttachment);

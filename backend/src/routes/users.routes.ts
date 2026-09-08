import { Router } from 'express';
import { usersController } from '../controllers/users.controller';
import { authenticate, requireRole } from '../middleware/auth';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', requireRole('SUPERADMIN', 'ADMIN'), usersController.getAll);
usersRouter.post('/', requireRole('SUPERADMIN', 'ADMIN'), usersController.create);
usersRouter.get('/:id', usersController.getById);
usersRouter.put('/:id', requireRole('SUPERADMIN', 'ADMIN'), usersController.update);
usersRouter.delete('/:id', requireRole('SUPERADMIN'), usersController.delete);
usersRouter.patch('/:id/password', usersController.changePassword);

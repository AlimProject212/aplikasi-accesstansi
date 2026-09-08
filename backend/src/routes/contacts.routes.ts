import { Router } from 'express';
import { contactsController } from '../controllers/contacts.controller';
import { authenticate } from '../middleware/auth';

export const contactsRouter = Router();

contactsRouter.use(authenticate);

contactsRouter.get('/', contactsController.getAll);
contactsRouter.post('/', contactsController.create);
contactsRouter.get('/:id', contactsController.getById);
contactsRouter.put('/:id', contactsController.update);
contactsRouter.delete('/:id', contactsController.delete);

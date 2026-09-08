import { Router } from 'express';
import { accountsController } from '../controllers/accounts.controller';
import { authenticate } from '../middleware/auth';

export const accountsRouter = Router();

accountsRouter.use(authenticate);

accountsRouter.get('/', accountsController.getAll);
accountsRouter.post('/bulk', accountsController.bulkCreate);
accountsRouter.put('/cash-flow', accountsController.updateCashFlow);
accountsRouter.post('/', accountsController.create);
accountsRouter.get('/:id', accountsController.getById);
accountsRouter.put('/:id', accountsController.update);
accountsRouter.delete('/:id', accountsController.delete);

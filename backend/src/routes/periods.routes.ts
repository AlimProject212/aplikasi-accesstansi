import { Router } from 'express';
import { periodsController } from '../controllers/periods.controller';
import { authenticate } from '../middleware/auth';

export const periodsRouter = Router();

periodsRouter.use(authenticate);

periodsRouter.get('/', periodsController.getAll);
periodsRouter.post('/', periodsController.create);
periodsRouter.delete('/:year', periodsController.delete);
periodsRouter.patch('/:year/active', periodsController.setActive);
periodsRouter.post('/:year/lock', periodsController.lockMonth);
periodsRouter.delete('/:year/lock/:yearMonth', periodsController.unlockMonth);

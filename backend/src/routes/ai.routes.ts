import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

export const aiRouter = Router();

aiRouter.use(authenticate);

aiRouter.post('/chat', aiController.chat);
aiRouter.get('/status', aiController.status);

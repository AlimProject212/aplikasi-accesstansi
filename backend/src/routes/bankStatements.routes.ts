import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { bankStatementUploadMiddleware } from '../middleware/bankStatementUpload';
import { bankStatementsController } from '../controllers/bankStatements.controller';

export const bankStatementsRouter = Router();

bankStatementsRouter.use(authenticate);

bankStatementsRouter.post('/parse', bankStatementUploadMiddleware, bankStatementsController.parse);
bankStatementsRouter.post('/keywords/reinforce', bankStatementsController.reinforceKeywords);
bankStatementsRouter.get('/keywords', bankStatementsController.listKeywords);

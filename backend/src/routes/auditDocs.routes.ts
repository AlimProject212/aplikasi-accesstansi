import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { uploadMiddleware } from '../middleware/multer';
import { auditDocsController } from '../controllers/auditDocs.controller';

export const auditDocsRouter = Router();

auditDocsRouter.use(authenticate, requireAddon('repository-dokumen'));

auditDocsRouter.get('/',                          auditDocsController.getAll);
auditDocsRouter.post('/upload', uploadMiddleware.single('file'), auditDocsController.upload);
auditDocsRouter.patch('/:id/status',              auditDocsController.updateStatus);
auditDocsRouter.get('/:id/download',              auditDocsController.download);
auditDocsRouter.delete('/:id',                    auditDocsController.delete);

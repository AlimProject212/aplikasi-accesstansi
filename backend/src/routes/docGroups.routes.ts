import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { docGroupsController } from '../controllers/docGroups.controller';

export const docGroupsRouter = Router();

docGroupsRouter.use(authenticate, requireAddon('repository-dokumen'));

docGroupsRouter.get('/',                              docGroupsController.getAll);
docGroupsRouter.post('/',                             docGroupsController.create);
docGroupsRouter.put('/:id',                           docGroupsController.update);
docGroupsRouter.delete('/:id',                        docGroupsController.delete);
docGroupsRouter.get('/:id/documents',                 docGroupsController.getDocuments);
docGroupsRouter.post('/:id/members',                  docGroupsController.addMembers);
docGroupsRouter.delete('/:id/members/:docId',         docGroupsController.removeMember);
docGroupsRouter.get('/by-document/:docId',            docGroupsController.getGroupsByDocument);

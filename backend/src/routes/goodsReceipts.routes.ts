import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAddon } from '../middleware/addon';
import { goodsReceiptsController } from '../controllers/goodsReceipts.controller';

export const goodsReceiptsRouter = Router();

goodsReceiptsRouter.use(authenticate, requireAddon('persediaan-dagang'));

goodsReceiptsRouter.get('/',       goodsReceiptsController.getAll);
goodsReceiptsRouter.get('/:id',    goodsReceiptsController.getById);
goodsReceiptsRouter.post('/',      goodsReceiptsController.create);
goodsReceiptsRouter.post('/:id/post', goodsReceiptsController.post);
goodsReceiptsRouter.delete('/:id', goodsReceiptsController.delete);

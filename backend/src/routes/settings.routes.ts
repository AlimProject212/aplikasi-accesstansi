import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { apiKeysController } from '../controllers/apikeys.controller';
import { authenticate } from '../middleware/auth';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get('/profile', settingsController.getProfile);
settingsRouter.put('/profile', settingsController.updateProfile);
settingsRouter.get('/config', settingsController.getConfig);
settingsRouter.put('/config', settingsController.updateConfig);
settingsRouter.get('/backup', settingsController.backup);

// API Key Configuration
settingsRouter.get('/api-keys', apiKeysController.getAll);
settingsRouter.post('/api-keys', apiKeysController.create);
settingsRouter.put('/api-keys/:id', apiKeysController.update);
settingsRouter.delete('/api-keys/:id', apiKeysController.delete);
settingsRouter.get('/api-keys/:id/reveal', apiKeysController.reveal);

import { Router } from 'express';

import { catalogController } from '../controllers/catalog.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { availabilityQuerySchema, tablesQuerySchema } from '../types/index.js';

export const catalogRouter = Router();

catalogRouter.get('/sectors', catalogController.getSectors);
catalogRouter.get('/shifts', catalogController.getShifts);
catalogRouter.get(
  '/tables',
  validateRequest({ query: tablesQuerySchema }),
  catalogController.getTables,
);
catalogRouter.get(
  '/availability',
  validateRequest({ query: availabilityQuerySchema }),
  catalogController.getAvailability,
);

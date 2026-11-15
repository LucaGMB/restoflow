import { Router } from 'express';

import { waitlistController } from '../controllers/waitlist.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  convertWaitlistSchema,
  createWaitlistSchema,
  idParamSchema,
  waitlistQuerySchema,
} from '../types/index.js';

export const waitlistRouter = Router();

waitlistRouter.get(
  '/',
  validateRequest({ query: waitlistQuerySchema }),
  waitlistController.list,
);
waitlistRouter.post(
  '/',
  validateRequest({ body: createWaitlistSchema }),
  waitlistController.create,
);
waitlistRouter.post(
  '/:id/convert',
  validateRequest({ params: idParamSchema, body: convertWaitlistSchema }),
  waitlistController.convert,
);

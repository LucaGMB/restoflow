import { Router } from 'express';

import { reservationController } from '../controllers/reservation.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  cancelByCodeSchema,
  createReservationSchema,
  idParamSchema,
  lookupReservationQuerySchema,
  reservationsListQuerySchema,
  updateReservationStatusSchema,
} from '../types/index.js';

export const reservationRouter = Router();

reservationRouter.get(
  '/',
  validateRequest({ query: reservationsListQuerySchema }),
  reservationController.list,
);
reservationRouter.get(
  '/lookup',
  validateRequest({ query: lookupReservationQuerySchema }),
  reservationController.lookup,
);
reservationRouter.post(
  '/',
  validateRequest({ body: createReservationSchema }),
  reservationController.create,
);
reservationRouter.post(
  '/cancel-by-code',
  validateRequest({ body: cancelByCodeSchema }),
  reservationController.cancelByCode,
);
reservationRouter.patch(
  '/:id/status',
  validateRequest({ params: idParamSchema, body: updateReservationStatusSchema }),
  reservationController.updateStatus,
);

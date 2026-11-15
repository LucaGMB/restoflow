import { Request, Response } from 'express';
import { z } from 'zod';

import { ValidatedRequestData } from '../middlewares/validate.middleware.js';
import { reservationService } from '../services/reservation.service.js';
import {
  CancelByCodeDto,
  CreateReservationDto,
  UpdateReservationStatusDto,
  idParamSchema,
  lookupReservationQuerySchema,
  reservationsListQuerySchema,
} from '../types/index.js';

export const reservationController = {
  async list(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const query = validated.query as z.infer<typeof reservationsListQuerySchema>;
    const reservations = await reservationService.listReservations(query);
    res.json({ reservations });
  },

  async lookup(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const query = validated.query as z.infer<typeof lookupReservationQuerySchema>;
    const reservation = await reservationService.lookupReservation(query.codigo, query.email);
    res.json({ reservation });
  },

  async create(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const body = validated.body as CreateReservationDto;
    const reservation = await reservationService.createReservation(body);
    res.status(201).json({
      message: 'Reserva confirmada exitosamente.',
      reservation,
    });
  },

  async cancelByCode(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const body = validated.body as CancelByCodeDto;
    const result = await reservationService.cancelByCode(body);
    res.json({
      message: 'Reserva cancelada correctamente.',
      ...result,
    });
  },

  async updateStatus(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const params = validated.params as z.infer<typeof idParamSchema>;
    const body = validated.body as UpdateReservationStatusDto;
    const result = await reservationService.updateReservationStatus(params.id, body.estado);
    res.json({
      message: `Estado de reserva actualizado a ${body.estado}.`,
      ...result,
    });
  },
};

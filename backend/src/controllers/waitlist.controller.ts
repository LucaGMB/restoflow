import { Request, Response } from 'express';
import { z } from 'zod';

import { ValidatedRequestData } from '../middlewares/validate.middleware.js';
import { waitlistService } from '../services/waitlist.service.js';
import {
  ConvertWaitlistDto,
  CreateWaitlistDto,
  idParamSchema,
  waitlistQuerySchema,
} from '../types/index.js';

export const waitlistController = {
  async list(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const query = validated.query as z.infer<typeof waitlistQuerySchema>;
    const waitlist = await waitlistService.listWaitlist(query);
    res.json({ waitlist });
  },

  async create(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const body = validated.body as CreateWaitlistDto;
    const entry = await waitlistService.joinWaitlist(body);
    res.status(201).json({
      message: 'Te anotamos en la lista de espera.',
      entry,
    });
  },

  async convert(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const params = validated.params as z.infer<typeof idParamSchema>;
    const body = validated.body as ConvertWaitlistDto;
    const result = await waitlistService.convertWaitlistEntry(params.id, body);
    res.json({
      message: 'Cliente promovido a reserva confirmada.',
      ...result,
    });
  },
};

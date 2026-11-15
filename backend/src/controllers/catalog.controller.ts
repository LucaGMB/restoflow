import { Request, Response } from 'express';

import { ValidatedRequestData } from '../middlewares/validate.middleware.js';
import { catalogService } from '../services/catalog.service.js';
import {
  availabilityQuerySchema,
  tablesQuerySchema,
} from '../types/index.js';
import { z } from 'zod';

export const catalogController = {
  async getSectors(_req: Request, res: Response): Promise<void> {
    const sectors = await catalogService.listSectors();
    res.json({ sectors });
  },

  async getShifts(_req: Request, res: Response): Promise<void> {
    const shifts = await catalogService.listShifts();
    res.json({ shifts });
  },

  async getTables(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const query = validated.query as z.infer<typeof tablesQuerySchema>;
    const payload = await catalogService.getTablesWithMetrics(query);
    res.json(payload);
  },

  async getAvailability(_req: Request, res: Response): Promise<void> {
    const validated = res.locals.validated as ValidatedRequestData;
    const query = validated.query as z.infer<typeof availabilityQuerySchema>;
    const availability = await catalogService.checkAvailability(query);
    res.json(availability);
  },
};

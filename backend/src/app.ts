import cors from 'cors';
import express, { Express } from 'express';

import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { catalogRouter } from './routes/catalog.routes.js';
import { reservationRouter } from './routes/reservation.routes.js';
import { waitlistRouter } from './routes/waitlist.routes.js';

/**
 * Builds and configures the RestoFlow Express application.
 */
export function createApp(): Express {
  const app = express();

  const allowedOrigins = env.corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'restoflow-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', catalogRouter);
  app.use('/api/reservations', reservationRouter);
  app.use('/api/waitlist', waitlistRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'Not Found',
      code: 'ENDPOINT_NOT_FOUND',
      message: 'El endpoint solicitado no existe.',
    });
  });

  app.use(errorMiddleware);

  return app;
}

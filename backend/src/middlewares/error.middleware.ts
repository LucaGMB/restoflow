import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../types/index.js';

const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

/**
 * Global Express error middleware translating domain and validation errors into structured JSON.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: STATUS_NAMES[err.statusCode] ?? 'Error',
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Los datos enviados no cumplen con el formato requerido.',
      details: {
        issues: err.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      },
    });
    return;
  }

  const unexpectedMessage =
    err instanceof Error ? err.message : 'Error interno inesperado del servidor';
  console.error('[RestoFlow API Error]:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Ocurrió un error interno inesperado.'
        : unexpectedMessage,
  });
}

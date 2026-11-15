import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

/**
 * Validates request body, query, or params against Zod schemas and stores parsed values in res.locals.validated.
 */
export function validateRequest(schemas: {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validated: ValidatedRequestData = (res.locals.validated as ValidatedRequestData) ?? {};

    if (schemas.params) {
      validated.params = schemas.params.parse(req.params);
    }
    if (schemas.query) {
      validated.query = schemas.query.parse(req.query);
    }
    if (schemas.body) {
      validated.body = schemas.body.parse(req.body ?? {});
    }

    res.locals.validated = validated;
    next();
  };
}

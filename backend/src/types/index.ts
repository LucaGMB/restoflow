import { EstadoListaEspera, EstadoMesa, EstadoReserva } from '@prisma/client';
import { z } from 'zod';

export const ACTIVE_RESERVATION_STATES: EstadoReserva[] = [
  EstadoReserva.PENDIENTE,
  EstadoReserva.CONFIRMADA,
  EstadoReserva.EN_CURSO,
];

export const TERMINAL_RESERVATION_STATES: EstadoReserva[] = [
  EstadoReserva.COMPLETADA,
  EstadoReserva.CANCELADA,
  EstadoReserva.NO_SHOW,
];

export const ALLOWED_RESERVATION_TRANSITIONS: Record<EstadoReserva, EstadoReserva[]> = {
  [EstadoReserva.PENDIENTE]: [
    EstadoReserva.CONFIRMADA,
    EstadoReserva.EN_CURSO,
    EstadoReserva.CANCELADA,
    EstadoReserva.NO_SHOW,
  ],
  [EstadoReserva.CONFIRMADA]: [
    EstadoReserva.EN_CURSO,
    EstadoReserva.CANCELADA,
    EstadoReserva.NO_SHOW,
  ],
  [EstadoReserva.EN_CURSO]: [EstadoReserva.COMPLETADA],
  [EstadoReserva.COMPLETADA]: [],
  [EstadoReserva.CANCELADA]: [],
  [EstadoReserva.NO_SHOW]: [],
};

export const NO_SHOW_WINDOW_DAYS = 30;
export const NO_SHOW_BLOCK_THRESHOLD = 2;
export const NO_SHOW_BLOCK_DURATION_DAYS = 30;

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const codeRegex = /^RF-[A-HJ-NP-Z2-9]{4}$/i;

export const dateStringSchema = z
  .string()
  .trim()
  .regex(dateRegex, 'La fecha debe tener el formato YYYY-MM-DD')
  .refine((val) => {
    const [y, m, d] = val.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return (
      parsed.getUTCFullYear() === y &&
      parsed.getUTCMonth() === m - 1 &&
      parsed.getUTCDate() === d
    );
  }, 'La fecha ingresada no es válida');

export const positiveIntCoerce = z.coerce
  .number()
  .int('Debe ser un número entero')
  .positive('Debe ser mayor a 0');

export const availabilityQuerySchema = z.object({
  fecha: dateStringSchema,
  turnoId: positiveIntCoerce,
  cantidadPersonas: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 persona')
    .max(20, 'Máximo 20 personas por reserva online'),
});

export const tablesQuerySchema = z.object({
  fecha: dateStringSchema.optional(),
  turnoId: positiveIntCoerce.optional(),
  sectorId: positiveIntCoerce.optional(),
});

export const reservationsListQuerySchema = z.object({
  fecha: dateStringSchema.optional(),
  turnoId: positiveIntCoerce.optional(),
  estado: z.nativeEnum(EstadoReserva).optional(),
  sectorId: positiveIntCoerce.optional(),
});

export const lookupReservationQuerySchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(codeRegex, 'El código debe tener formato RF-XXXX'),
  email: z.string().trim().toLowerCase().email('Ingresá un correo electrónico válido'),
});

export const createReservationSchema = z.object({
  fecha: dateStringSchema,
  turnoId: positiveIntCoerce,
  sectorId: positiveIntCoerce.optional(),
  mesaId: positiveIntCoerce.optional(),
  cantidadPersonas: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 persona')
    .max(20, 'Máximo 20 personas por reserva online'),
  nombre: z.string().trim().min(2, 'Ingresá tu nombre completo (mínimo 2 caracteres)').max(100),
  email: z.string().trim().toLowerCase().email('Ingresá un correo electrónico válido').max(150),
  telefono: z.string().trim().min(6, 'Ingresá un teléfono de contacto válido').max(40),
  notas: z.string().trim().max(400).optional(),
});

export const cancelByCodeSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(codeRegex, 'El código debe tener formato RF-XXXX'),
  email: z.string().trim().toLowerCase().email('Ingresá un correo electrónico válido'),
});

export const updateReservationStatusSchema = z.object({
  estado: z.nativeEnum(EstadoReserva),
});

export const idParamSchema = z.object({
  id: positiveIntCoerce,
});

export const waitlistQuerySchema = z.object({
  fecha: dateStringSchema.optional(),
  turnoId: positiveIntCoerce.optional(),
  estado: z.nativeEnum(EstadoListaEspera).optional(),
});

export const createWaitlistSchema = z.object({
  fecha: dateStringSchema,
  turnoId: positiveIntCoerce,
  cantidadPersonas: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 persona')
    .max(20, 'Máximo 20 personas'),
  nombre: z.string().trim().min(2, 'Ingresá tu nombre completo').max(100),
  email: z.string().trim().toLowerCase().email('Ingresá un correo electrónico válido').max(150),
  telefono: z.string().trim().min(6, 'Ingresá un teléfono de contacto válido').max(40),
});

export const convertWaitlistSchema = z.object({
  sectorId: positiveIntCoerce.optional(),
  mesaId: positiveIntCoerce.optional(),
  notas: z.string().trim().max(400).optional(),
});

export type CreateReservationDto = z.infer<typeof createReservationSchema>;
export type CancelByCodeDto = z.infer<typeof cancelByCodeSchema>;
export type UpdateReservationStatusDto = z.infer<typeof updateReservationStatusSchema>;
export type CreateWaitlistDto = z.infer<typeof createWaitlistSchema>;
export type ConvertWaitlistDto = z.infer<typeof convertWaitlistSchema>;

export interface TableStatusView {
  id: number;
  numero: string;
  capacidadMin: number;
  capacidadMax: number;
  sectorId: number;
  sectorNombre: string;
  estadoBase: EstadoMesa;
  estadoOperativo: EstadoMesa;
  activeReservation: {
    id: number;
    codigo: string;
    estado: EstadoReserva;
    cantidadPersonas: number;
    notas: string | null;
    clienteNombre: string;
    clienteEmail: string;
    clienteTelefono: string;
  } | null;
}

export interface ShiftMetrics {
  totalTables: number;
  activeTables: number;
  freeTables: number;
  reservedTables: number;
  occupiedTables: number;
  maintenanceTables: number;
  totalCapacity: number;
  reservedCovers: number;
  freeCovers: number;
  occupancyPercentage: number;
}

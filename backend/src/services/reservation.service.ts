import { EstadoListaEspera, EstadoMesa, EstadoReserva } from '@prisma/client';

import { prisma } from '../config/db.js';
import { catalogRepository, DbClient } from '../repositories/catalog.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import {
  reservationRepository,
  ReservationWithRelations,
} from '../repositories/reservation.repository.js';
import {
  waitlistRepository,
  WaitlistWithRelations,
} from '../repositories/waitlist.repository.js';
import {
  ALLOWED_RESERVATION_TRANSITIONS,
  AppError,
  CancelByCodeDto,
  CreateReservationDto,
  NO_SHOW_BLOCK_DURATION_DAYS,
  NO_SHOW_BLOCK_THRESHOLD,
  NO_SHOW_WINDOW_DAYS,
} from '../types/index.js';
import {
  formatDateOnlyUtc,
  generateUniqueReservationCode,
  parseDateOnlyUtc,
  withBookingLock,
} from './codeGenerator.js';

export function serializeReservation(reserva: ReservationWithRelations) {
  return {
    id: reserva.id,
    codigo: reserva.codigo,
    fecha: formatDateOnlyUtc(reserva.fecha),
    estado: reserva.estado,
    cantidadPersonas: reserva.cantidadPersonas,
    notas: reserva.notas,
    createdAt: reserva.createdAt.toISOString(),
    updatedAt: reserva.updatedAt.toISOString(),
    turno: {
      id: reserva.turno.id,
      nombre: reserva.turno.nombre,
      horaInicio: reserva.turno.horaInicio,
      horaFin: reserva.turno.horaFin,
    },
    mesa: {
      id: reserva.mesa.id,
      numero: reserva.mesa.numero,
      capacidadMin: reserva.mesa.capacidadMin,
      capacidadMax: reserva.mesa.capacidadMax,
      sectorId: reserva.mesa.sectorId,
      sectorNombre: reserva.mesa.sector.nombre,
    },
    cliente: {
      id: reserva.cliente.id,
      nombre: reserva.cliente.nombre,
      email: reserva.cliente.email,
      telefono: reserva.cliente.telefono,
      contadorNoShows: reserva.cliente.contadorNoShows,
      bloqueadoHasta: reserva.cliente.bloqueadoHasta?.toISOString() ?? null,
    },
  };
}

export function serializeWaitlistEntry(entry: WaitlistWithRelations) {
  return {
    id: entry.id,
    fecha: formatDateOnlyUtc(entry.fecha),
    turnoId: entry.turnoId,
    turnoNombre: entry.turno.nombre,
    horaInicio: entry.turno.horaInicio,
    horaFin: entry.turno.horaFin,
    cantidadPersonas: entry.cantidadPersonas,
    prioridad: entry.prioridad,
    estado: entry.estado,
    createdAt: entry.createdAt.toISOString(),
    cliente: {
      id: entry.cliente.id,
      nombre: entry.cliente.nombre,
      email: entry.cliente.email,
      telefono: entry.cliente.telefono,
    },
  };
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Ensures customer is not temporarily blocked by accumulated no-shows (RN-03).
 */
export async function assertCustomerNotBlocked(email: string, db: DbClient): Promise<void> {
  const existingCustomer = await customerRepository.findByEmail(email, db);
  if (existingCustomer?.bloqueadoHasta && existingCustomer.bloqueadoHasta > new Date()) {
    throw new AppError(
      422,
      'CUSTOMER_BLOCKED',
      `Este correo electrónico está temporalmente bloqueado hasta el ${formatDateOnlyUtc(existingCustomer.bloqueadoHasta)} por acumulación de ausencias (No-Show).`,
      {
        bloqueadoHasta: existingCustomer.bloqueadoHasta.toISOString(),
        contadorNoShows: existingCustomer.contadorNoShows,
      },
    );
  }
}

/**
 * Selects an optimal table within a transaction, honoring explicit mesaId or RN-02 smallest-fit rule.
 */
async function selectTableForSlot(
  params: {
    fecha: Date;
    turnoId: number;
    cantidadPersonas: number;
    sectorId?: number;
    mesaId?: number;
  },
  db: DbClient,
) {
  if (params.mesaId !== undefined) {
    const requestedTable = await catalogRepository.findTableById(params.mesaId, db);
    if (!requestedTable) {
      throw new AppError(404, 'TABLE_NOT_FOUND', `La mesa ${params.mesaId} no existe.`);
    }
    if (requestedTable.estadoActual === EstadoMesa.MANTENIMIENTO) {
      throw new AppError(
        409,
        'TABLE_IN_MAINTENANCE',
        `La mesa ${requestedTable.numero} se encuentra en mantenimiento.`,
      );
    }
    if (
      params.cantidadPersonas < requestedTable.capacidadMin ||
      params.cantidadPersonas > requestedTable.capacidadMax
    ) {
      throw new AppError(
        422,
        'INVALID_TABLE_CAPACITY',
        `La mesa ${requestedTable.numero} admite entre ${requestedTable.capacidadMin} y ${requestedTable.capacidadMax} personas.`,
      );
    }
    if (params.sectorId !== undefined && requestedTable.sectorId !== params.sectorId) {
      throw new AppError(
        422,
        'TABLE_SECTOR_MISMATCH',
        `La mesa ${requestedTable.numero} no pertenece al sector seleccionado.`,
      );
    }
    const existingBooking = await reservationRepository.findActiveForTableSlot(
      requestedTable.id,
      params.fecha,
      params.turnoId,
      db,
    );
    if (existingBooking) {
      throw new AppError(
        409,
        'TABLE_ALREADY_BOOKED',
        `La mesa ${requestedTable.numero} ya posee una reserva activa para ese turno.`,
      );
    }
    return requestedTable;
  }

  const compatibleTables = await catalogRepository.findCompatibleTables(
    { cantidadPersonas: params.cantidadPersonas, sectorId: params.sectorId },
    db,
  );
  const activeReservations = await reservationRepository.findActiveByDateAndShift(
    params.fecha,
    params.turnoId,
    db,
  );
  const occupiedTableIds = new Set(activeReservations.map((r) => r.mesaId));

  const optimalTable = compatibleTables.find((table) => !occupiedTableIds.has(table.id));
  if (!optimalTable) {
    throw new AppError(
      409,
      'NO_AVAILABILITY',
      'No hay mesas disponibles para esa cantidad de personas en el turno y sector seleccionados.',
      { canJoinWaitlist: true },
    );
  }

  return optimalTable;
}

/**
 * Creates a reservation inside an atomic transaction using an existing DB client or transaction.
 */
export async function createReservationInTx(
  dto: CreateReservationDto,
  db: DbClient,
): Promise<ReservationWithRelations> {
  const shift = await catalogRepository.findShiftById(dto.turnoId, db);
  if (!shift) {
    throw new AppError(404, 'SHIFT_NOT_FOUND', `El turno ${dto.turnoId} no existe.`);
  }

  if (dto.sectorId !== undefined) {
    const sector = await catalogRepository.findSectorById(dto.sectorId, db);
    if (!sector || !sector.activo) {
      throw new AppError(404, 'SECTOR_NOT_FOUND', `El sector ${dto.sectorId} no está disponible.`);
    }
  }

  await assertCustomerNotBlocked(dto.email, db);

  const normalizedDate = parseDateOnlyUtc(dto.fecha);
  const table = await selectTableForSlot(
    {
      fecha: normalizedDate,
      turnoId: dto.turnoId,
      cantidadPersonas: dto.cantidadPersonas,
      sectorId: dto.sectorId,
      mesaId: dto.mesaId,
    },
    db,
  );

  const customer = await customerRepository.upsertCustomer(
    {
      nombre: dto.nombre,
      email: dto.email,
      telefono: dto.telefono,
    },
    db,
  );

  const codigo = await generateUniqueReservationCode(db);

  return reservationRepository.create(
    {
      codigo,
      fecha: normalizedDate,
      turnoId: dto.turnoId,
      mesaId: table.id,
      clienteId: customer.id,
      cantidadPersonas: dto.cantidadPersonas,
      notas: dto.notas,
      estado: EstadoReserva.CONFIRMADA,
    },
    db,
  );
}

/**
 * Promotes the first compatible FIFO waitlist entry to NOTIFICADO when a table frees up (RN-04).
 */
async function promoteNextCompatibleWaitlist(
  freedReservation: ReservationWithRelations,
  db: DbClient,
): Promise<WaitlistWithRelations | null> {
  const eligible = await waitlistRepository.findNextEligible(
    {
      fecha: freedReservation.fecha,
      turnoId: freedReservation.turnoId,
      minGuests: freedReservation.mesa.capacidadMin,
      maxGuests: freedReservation.mesa.capacidadMax,
    },
    db,
  );

  if (!eligible) {
    return null;
  }

  return waitlistRepository.updateStatus(eligible.id, EstadoListaEspera.NOTIFICADO, db);
}

export const reservationService = {
  async listReservations(filters: {
    fecha?: string;
    turnoId?: number;
    estado?: EstadoReserva;
    sectorId?: number;
  }) {
    const reservas = await reservationRepository.findFiltered({
      fecha: filters.fecha ? parseDateOnlyUtc(filters.fecha) : undefined,
      turnoId: filters.turnoId,
      estado: filters.estado,
      sectorId: filters.sectorId,
    });
    return reservas.map(serializeReservation);
  },

  async lookupReservation(codigo: string, email: string) {
    const reserva = await reservationRepository.findByCodigo(codigo);
    if (!reserva || reserva.cliente.email.toLowerCase() !== email.trim().toLowerCase()) {
      throw new AppError(
        404,
        'RESERVATION_NOT_FOUND',
        'No encontramos ninguna reserva que coincida con ese código y correo electrónico.',
      );
    }
    return serializeReservation(reserva);
  },

  async createReservation(dto: CreateReservationDto) {
    return withBookingLock(async () => {
      const created = await prisma.$transaction(async (tx) =>
        createReservationInTx(dto, tx),
      );
      return serializeReservation(created);
    });
  },

  async cancelByCode(dto: CancelByCodeDto) {
    return withBookingLock(async () => {
      const existing = await reservationRepository.findByCodigo(dto.codigo);
      if (!existing || existing.cliente.email.toLowerCase() !== dto.email.trim().toLowerCase()) {
        throw new AppError(
          404,
          'RESERVATION_NOT_FOUND',
          'No encontramos ninguna reserva que coincida con ese código y correo electrónico.',
        );
      }

      return prisma.$transaction(async (tx) => {
        const current = await reservationRepository.findById(existing.id, tx);
        if (!current) {
          throw new AppError(404, 'RESERVATION_NOT_FOUND', 'La reserva no existe.');
        }

        const allowed = ALLOWED_RESERVATION_TRANSITIONS[current.estado];
        if (!allowed.includes(EstadoReserva.CANCELADA)) {
          throw new AppError(
            409,
            'INVALID_STATE_TRANSITION',
            `La reserva ${current.codigo} ya se encuentra en estado ${current.estado} y no puede cancelarse.`,
          );
        }

        const updated = await reservationRepository.updateStatus(
          current.id,
          EstadoReserva.CANCELADA,
          tx,
        );
        const promotedWaitlist = await promoteNextCompatibleWaitlist(updated, tx);

        return {
          reservation: serializeReservation(updated),
          promotedWaitlist: promotedWaitlist ? serializeWaitlistEntry(promotedWaitlist) : null,
        };
      });
    });
  },

  async updateReservationStatus(id: number, nextEstado: EstadoReserva) {
    return withBookingLock(async () => {
      return prisma.$transaction(async (tx) => {
        const current = await reservationRepository.findById(id, tx);
        if (!current) {
          throw new AppError(404, 'RESERVATION_NOT_FOUND', `La reserva ${id} no existe.`);
        }

        const allowed = ALLOWED_RESERVATION_TRANSITIONS[current.estado];
        if (!allowed.includes(nextEstado)) {
          throw new AppError(
            409,
            'INVALID_STATE_TRANSITION',
            `No es posible pasar la reserva ${current.codigo} de ${current.estado} a ${nextEstado}.`,
          );
        }

        const updated = await reservationRepository.updateStatus(current.id, nextEstado, tx);

        let customerBlocked = false;
        let promotedWaitlist: WaitlistWithRelations | null = null;

        if (nextEstado === EstadoReserva.NO_SHOW) {
          const now = new Date();
          const windowStart = addDays(now, -NO_SHOW_WINDOW_DAYS);
          const recentNoShows = await reservationRepository.countRecentNoShows(
            updated.clienteId,
            windowStart,
            tx,
          );
          const shouldBlock = recentNoShows >= NO_SHOW_BLOCK_THRESHOLD;
          const bloqueadoHasta = shouldBlock
            ? addDays(now, NO_SHOW_BLOCK_DURATION_DAYS)
            : updated.cliente.bloqueadoHasta;

          await customerRepository.updateNoShowTracking(
            updated.clienteId,
            {
              contadorNoShows: updated.cliente.contadorNoShows + 1,
              ultimoNoShowAt: now,
              ...(bloqueadoHasta ? { bloqueadoHasta } : {}),
            },
            tx,
          );
          customerBlocked = shouldBlock;
          promotedWaitlist = await promoteNextCompatibleWaitlist(updated, tx);
        } else if (nextEstado === EstadoReserva.CANCELADA) {
          promotedWaitlist = await promoteNextCompatibleWaitlist(updated, tx);
        }

        const refreshed = (await reservationRepository.findById(updated.id, tx)) ?? updated;

        return {
          reservation: serializeReservation(refreshed),
          customerBlocked,
          promotedWaitlist: promotedWaitlist ? serializeWaitlistEntry(promotedWaitlist) : null,
        };
      });
    });
  },
};

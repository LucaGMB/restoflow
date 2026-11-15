import { EstadoReserva, Prisma } from '@prisma/client';

import { prisma } from '../config/db.js';
import { ACTIVE_RESERVATION_STATES } from '../types/index.js';
import { DbClient } from './catalog.repository.js';

const reservationWithRelations = {
  turno: true,
  mesa: { include: { sector: true } },
  cliente: true,
} satisfies Prisma.ReservaInclude;

export type ReservationWithRelations = Prisma.ReservaGetPayload<{
  include: typeof reservationWithRelations;
}>;

export const reservationRepository = {
  async findById(id: number, db: DbClient = prisma) {
    return db.reserva.findUnique({
      where: { id },
      include: reservationWithRelations,
    });
  },

  async findByCodigo(codigo: string, db: DbClient = prisma) {
    return db.reserva.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: reservationWithRelations,
    });
  },

  async findActiveByDateAndShift(
    fecha: Date,
    turnoId: number,
    db: DbClient = prisma,
  ) {
    return db.reserva.findMany({
      where: {
        fecha,
        turnoId,
        estado: { in: ACTIVE_RESERVATION_STATES },
      },
      include: reservationWithRelations,
    });
  },

  async findActiveForTableSlot(
    mesaId: number,
    fecha: Date,
    turnoId: number,
    db: DbClient = prisma,
  ) {
    return db.reserva.findFirst({
      where: {
        mesaId,
        fecha,
        turnoId,
        estado: { in: ACTIVE_RESERVATION_STATES },
      },
    });
  },

  async findFiltered(
    filters: {
      fecha?: Date;
      turnoId?: number;
      estado?: EstadoReserva;
      sectorId?: number;
    },
    db: DbClient = prisma,
  ) {
    return db.reserva.findMany({
      where: {
        ...(filters.fecha ? { fecha: filters.fecha } : {}),
        ...(filters.turnoId ? { turnoId: filters.turnoId } : {}),
        ...(filters.estado ? { estado: filters.estado } : {}),
        ...(filters.sectorId ? { mesa: { sectorId: filters.sectorId } } : {}),
      },
      include: reservationWithRelations,
      orderBy: [{ fecha: 'asc' }, { turnoId: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async countRecentNoShows(
    clienteId: number,
    since: Date,
    db: DbClient = prisma,
  ): Promise<number> {
    return db.reserva.count({
      where: {
        clienteId,
        estado: EstadoReserva.NO_SHOW,
        updatedAt: { gte: since },
      },
    });
  },

  async create(
    data: {
      codigo: string;
      fecha: Date;
      turnoId: number;
      mesaId: number;
      clienteId: number;
      cantidadPersonas: number;
      notas?: string;
      estado?: EstadoReserva;
    },
    db: DbClient = prisma,
  ) {
    return db.reserva.create({
      data: {
        codigo: data.codigo,
        fecha: data.fecha,
        turnoId: data.turnoId,
        mesaId: data.mesaId,
        clienteId: data.clienteId,
        cantidadPersonas: data.cantidadPersonas,
        notas: data.notas ?? null,
        estado: data.estado ?? EstadoReserva.CONFIRMADA,
      },
      include: reservationWithRelations,
    });
  },

  async updateStatus(
    id: number,
    estado: EstadoReserva,
    db: DbClient = prisma,
  ) {
    return db.reserva.update({
      where: { id },
      data: { estado },
      include: reservationWithRelations,
    });
  },
};

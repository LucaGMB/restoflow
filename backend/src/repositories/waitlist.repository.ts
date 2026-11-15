import { EstadoListaEspera, Prisma } from '@prisma/client';

import { prisma } from '../config/db.js';
import { DbClient } from './catalog.repository.js';

const waitlistWithRelations = {
  turno: true,
  cliente: true,
} satisfies Prisma.ListaEsperaInclude;

export type WaitlistWithRelations = Prisma.ListaEsperaGetPayload<{
  include: typeof waitlistWithRelations;
}>;

export const waitlistRepository = {
  async findById(id: number, db: DbClient = prisma) {
    return db.listaEspera.findUnique({
      where: { id },
      include: waitlistWithRelations,
    });
  },

  async findFiltered(
    filters: { fecha?: Date; turnoId?: number; estado?: EstadoListaEspera },
    db: DbClient = prisma,
  ) {
    return db.listaEspera.findMany({
      where: {
        ...(filters.fecha ? { fecha: filters.fecha } : {}),
        ...(filters.turnoId ? { turnoId: filters.turnoId } : {}),
        ...(filters.estado ? { estado: filters.estado } : {}),
      },
      include: waitlistWithRelations,
      orderBy: [{ prioridad: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async getNextPriority(
    fecha: Date,
    turnoId: number,
    db: DbClient = prisma,
  ): Promise<number> {
    const aggregate = await db.listaEspera.aggregate({
      where: { fecha, turnoId },
      _max: { prioridad: true },
    });
    return (aggregate._max.prioridad ?? 0) + 1;
  },

  async findActiveDuplicate(
    params: { fecha: Date; turnoId: number; clienteId: number },
    db: DbClient = prisma,
  ) {
    return db.listaEspera.findFirst({
      where: {
        fecha: params.fecha,
        turnoId: params.turnoId,
        clienteId: params.clienteId,
        estado: { in: [EstadoListaEspera.EN_ESPERA, EstadoListaEspera.NOTIFICADO] },
      },
      include: waitlistWithRelations,
    });
  },

  async findNextEligible(
    params: {
      fecha: Date;
      turnoId: number;
      minGuests: number;
      maxGuests: number;
    },
    db: DbClient = prisma,
  ) {
    return db.listaEspera.findFirst({
      where: {
        fecha: params.fecha,
        turnoId: params.turnoId,
        estado: EstadoListaEspera.EN_ESPERA,
        cantidadPersonas: {
          gte: params.minGuests,
          lte: params.maxGuests,
        },
      },
      include: waitlistWithRelations,
      orderBy: [{ prioridad: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async create(
    data: {
      fecha: Date;
      turnoId: number;
      clienteId: number;
      cantidadPersonas: number;
      prioridad: number;
    },
    db: DbClient = prisma,
  ) {
    return db.listaEspera.create({
      data: {
        fecha: data.fecha,
        turnoId: data.turnoId,
        clienteId: data.clienteId,
        cantidadPersonas: data.cantidadPersonas,
        prioridad: data.prioridad,
        estado: EstadoListaEspera.EN_ESPERA,
      },
      include: waitlistWithRelations,
    });
  },

  async updateStatus(
    id: number,
    estado: EstadoListaEspera,
    db: DbClient = prisma,
  ) {
    return db.listaEspera.update({
      where: { id },
      data: { estado },
      include: waitlistWithRelations,
    });
  },
};

import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../config/db.js';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export const catalogRepository = {
  async findActiveSectors(db: DbClient = prisma) {
    return db.sector.findMany({
      where: { activo: true },
      include: {
        _count: { select: { mesas: true } },
      },
      orderBy: { id: 'asc' },
    });
  },

  async findSectorById(id: number, db: DbClient = prisma) {
    return db.sector.findUnique({ where: { id } });
  },

  async findAllShifts(db: DbClient = prisma) {
    return db.turno.findMany({
      orderBy: { horaInicio: 'asc' },
    });
  },

  async findShiftById(id: number, db: DbClient = prisma) {
    return db.turno.findUnique({ where: { id } });
  },

  async findTables(sectorId?: number, db: DbClient = prisma) {
    return db.mesa.findMany({
      where: {
        ...(sectorId ? { sectorId } : {}),
        sector: { activo: true },
      },
      include: { sector: true },
      orderBy: [{ sectorId: 'asc' }, { numero: 'asc' }],
    });
  },

  async findTableById(id: number, db: DbClient = prisma) {
    return db.mesa.findUnique({
      where: { id },
      include: { sector: true },
    });
  },

  async findCompatibleTables(
    params: { cantidadPersonas: number; sectorId?: number },
    db: DbClient = prisma,
  ) {
    return db.mesa.findMany({
      where: {
        ...(params.sectorId ? { sectorId: params.sectorId } : {}),
        sector: { activo: true },
        estadoActual: { not: 'MANTENIMIENTO' },
        capacidadMin: { lte: params.cantidadPersonas },
        capacidadMax: { gte: params.cantidadPersonas },
      },
      include: { sector: true },
      orderBy: [
        { capacidadMax: 'asc' },
        { capacidadMin: 'asc' },
        { numero: 'asc' },
      ],
    });
  },
};

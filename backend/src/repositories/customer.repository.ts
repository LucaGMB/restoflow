import { prisma } from '../config/db.js';
import { DbClient } from './catalog.repository.js';

export const customerRepository = {
  async findByEmail(email: string, db: DbClient = prisma) {
    return db.cliente.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  },

  async upsertCustomer(
    data: { nombre: string; email: string; telefono: string },
    db: DbClient = prisma,
  ) {
    const normalizedEmail = data.email.trim().toLowerCase();
    return db.cliente.upsert({
      where: { email: normalizedEmail },
      update: {
        nombre: data.nombre.trim(),
        telefono: data.telefono.trim(),
      },
      create: {
        nombre: data.nombre.trim(),
        email: normalizedEmail,
        telefono: data.telefono.trim(),
      },
    });
  },

  async updateNoShowTracking(
    clienteId: number,
    data: {
      contadorNoShows: number;
      ultimoNoShowAt: Date;
      bloqueadoHasta?: Date | null;
    },
    db: DbClient = prisma,
  ) {
    return db.cliente.update({
      where: { id: clienteId },
      data,
    });
  },
};

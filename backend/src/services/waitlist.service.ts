import { EstadoListaEspera } from '@prisma/client';

import { prisma } from '../config/db.js';
import { catalogRepository } from '../repositories/catalog.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { waitlistRepository } from '../repositories/waitlist.repository.js';
import { AppError, ConvertWaitlistDto, CreateWaitlistDto } from '../types/index.js';
import { parseDateOnlyUtc, withBookingLock } from './codeGenerator.js';
import {
  assertCustomerNotBlocked,
  createReservationInTx,
  serializeReservation,
  serializeWaitlistEntry,
} from './reservation.service.js';

export const waitlistService = {
  async listWaitlist(filters: {
    fecha?: string;
    turnoId?: number;
    estado?: EstadoListaEspera;
  }) {
    const entries = await waitlistRepository.findFiltered({
      fecha: filters.fecha ? parseDateOnlyUtc(filters.fecha) : undefined,
      turnoId: filters.turnoId,
      estado: filters.estado,
    });
    return entries.map(serializeWaitlistEntry);
  },

  async joinWaitlist(dto: CreateWaitlistDto) {
    const shift = await catalogRepository.findShiftById(dto.turnoId);
    if (!shift) {
      throw new AppError(404, 'SHIFT_NOT_FOUND', `El turno ${dto.turnoId} no existe.`);
    }

    return withBookingLock(async () => {
      return prisma.$transaction(async (tx) => {
        await assertCustomerNotBlocked(dto.email, tx);

        const customer = await customerRepository.upsertCustomer(
          {
            nombre: dto.nombre,
            email: dto.email,
            telefono: dto.telefono,
          },
          tx,
        );

        const normalizedDate = parseDateOnlyUtc(dto.fecha);
        const existingEntry = await waitlistRepository.findActiveDuplicate(
          {
            fecha: normalizedDate,
            turnoId: dto.turnoId,
            clienteId: customer.id,
          },
          tx,
        );

        if (existingEntry) {
          throw new AppError(
            409,
            'WAITLIST_ALREADY_REGISTERED',
            'Ya tenés una solicitud activa en la lista de espera para ese turno y fecha.',
          );
        }

        const prioridad = await waitlistRepository.getNextPriority(
          normalizedDate,
          dto.turnoId,
          tx,
        );

        const entry = await waitlistRepository.create(
          {
            fecha: normalizedDate,
            turnoId: dto.turnoId,
            clienteId: customer.id,
            cantidadPersonas: dto.cantidadPersonas,
            prioridad,
          },
          tx,
        );

        return serializeWaitlistEntry(entry);
      });
    });
  },

  async convertWaitlistEntry(id: number, dto: ConvertWaitlistDto) {
    return withBookingLock(async () => {
      return prisma.$transaction(async (tx) => {
        const entry = await waitlistRepository.findById(id, tx);
        if (!entry) {
          throw new AppError(404, 'WAITLIST_NOT_FOUND', `La entrada de lista de espera ${id} no existe.`);
        }

        if (
          entry.estado !== EstadoListaEspera.EN_ESPERA &&
          entry.estado !== EstadoListaEspera.NOTIFICADO
        ) {
          throw new AppError(
            422,
            'WAITLIST_ALREADY_CONVERTED',
            `La solicitud de ${entry.cliente.nombre} está en estado ${entry.estado} y no puede convertirse.`,
          );
        }

        const reservation = await createReservationInTx(
          {
            fecha: entry.fecha.toISOString().slice(0, 10),
            turnoId: entry.turnoId,
            sectorId: dto.sectorId,
            mesaId: dto.mesaId,
            cantidadPersonas: entry.cantidadPersonas,
            nombre: entry.cliente.nombre,
            email: entry.cliente.email,
            telefono: entry.cliente.telefono,
            notas: dto.notas ?? 'Promovido desde Lista de Espera',
          },
          tx,
        );

        const updatedEntry = await waitlistRepository.updateStatus(
          entry.id,
          EstadoListaEspera.CONVERTIDO,
          tx,
        );

        return {
          entry: serializeWaitlistEntry(updatedEntry),
          reservation: serializeReservation(reservation),
        };
      });
    });
  },
};

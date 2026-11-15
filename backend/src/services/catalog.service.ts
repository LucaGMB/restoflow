import { EstadoMesa, EstadoReserva } from '@prisma/client';

import { catalogRepository } from '../repositories/catalog.repository.js';
import { reservationRepository } from '../repositories/reservation.repository.js';
import { AppError, ShiftMetrics, TableStatusView } from '../types/index.js';
import { formatDateOnlyUtc, parseDateOnlyUtc, todayUtcDate } from './codeGenerator.js';

function resolveOperationalStatus(
  baseStatus: EstadoMesa,
  activeReservationEstado?: EstadoReserva,
): EstadoMesa {
  if (baseStatus === EstadoMesa.MANTENIMIENTO) {
    return EstadoMesa.MANTENIMIENTO;
  }
  if (activeReservationEstado === EstadoReserva.EN_CURSO) {
    return EstadoMesa.OCUPADA;
  }
  if (
    activeReservationEstado === EstadoReserva.CONFIRMADA ||
    activeReservationEstado === EstadoReserva.PENDIENTE
  ) {
    return EstadoMesa.RESERVADA;
  }
  return EstadoMesa.LIBRE;
}

export const catalogService = {
  async listSectors() {
    const sectors = await catalogRepository.findActiveSectors();
    return sectors.map((sector) => ({
      id: sector.id,
      nombre: sector.nombre,
      descripcion: sector.descripcion,
      activo: sector.activo,
      tablesCount: sector._count.mesas,
    }));
  },

  async listShifts() {
    return catalogRepository.findAllShifts();
  },

  async getTablesWithMetrics(params: {
    fecha?: string;
    turnoId?: number;
    sectorId?: number;
  }): Promise<{
    fecha: string;
    turnoId: number;
    metrics: ShiftMetrics;
    tables: TableStatusView[];
  }> {
    const shifts = await catalogRepository.findAllShifts();
    if (shifts.length === 0) {
      throw new AppError(404, 'SHIFTS_NOT_FOUND', 'No hay turnos configurados en el sistema.');
    }

    const targetShiftId = params.turnoId ?? shifts[0].id;
    const shiftExists = shifts.some((s) => s.id === targetShiftId);
    if (!shiftExists) {
      throw new AppError(404, 'SHIFT_NOT_FOUND', `El turno ${targetShiftId} no existe.`);
    }

    const targetDate = params.fecha ? parseDateOnlyUtc(params.fecha) : todayUtcDate();
    const [allTables, activeReservations] = await Promise.all([
      catalogRepository.findTables(params.sectorId),
      reservationRepository.findActiveByDateAndShift(targetDate, targetShiftId),
    ]);

    const reservationByTableId = new Map(
      activeReservations.map((reserva) => [reserva.mesaId, reserva]),
    );

    const tables: TableStatusView[] = allTables.map((table) => {
      const active = reservationByTableId.get(table.id);
      const estadoOperativo = resolveOperationalStatus(table.estadoActual, active?.estado);
      return {
        id: table.id,
        numero: table.numero,
        capacidadMin: table.capacidadMin,
        capacidadMax: table.capacidadMax,
        sectorId: table.sectorId,
        sectorNombre: table.sector.nombre,
        estadoBase: table.estadoActual,
        estadoOperativo,
        activeReservation: active
          ? {
              id: active.id,
              codigo: active.codigo,
              estado: active.estado,
              cantidadPersonas: active.cantidadPersonas,
              notas: active.notas,
              clienteNombre: active.cliente.nombre,
              clienteEmail: active.cliente.email,
              clienteTelefono: active.cliente.telefono,
            }
          : null,
      };
    });

    const maintenanceTables = tables.filter(
      (t) => t.estadoOperativo === EstadoMesa.MANTENIMIENTO,
    ).length;
    const activeTablesList = tables.filter(
      (t) => t.estadoOperativo !== EstadoMesa.MANTENIMIENTO,
    );
    const freeTables = tables.filter((t) => t.estadoOperativo === EstadoMesa.LIBRE).length;
    const reservedTables = tables.filter((t) => t.estadoOperativo === EstadoMesa.RESERVADA).length;
    const occupiedTables = tables.filter((t) => t.estadoOperativo === EstadoMesa.OCUPADA).length;

    const totalCapacity = activeTablesList.reduce((acc, t) => acc + t.capacidadMax, 0);
    const reservedCovers = activeTablesList.reduce(
      (acc, t) => acc + (t.activeReservation ? t.activeReservation.cantidadPersonas : 0),
      0,
    );
    const busyTablesCount = reservedTables + occupiedTables;
    const occupancyPercentage =
      activeTablesList.length > 0
        ? Math.round((busyTablesCount / activeTablesList.length) * 100)
        : 0;

    return {
      fecha: formatDateOnlyUtc(targetDate),
      turnoId: targetShiftId,
      metrics: {
        totalTables: tables.length,
        activeTables: activeTablesList.length,
        freeTables,
        reservedTables,
        occupiedTables,
        maintenanceTables,
        totalCapacity,
        reservedCovers,
        freeCovers: Math.max(0, totalCapacity - reservedCovers),
        occupancyPercentage,
      },
      tables,
    };
  },

  async checkAvailability(params: {
    fecha: string;
    turnoId: number;
    cantidadPersonas: number;
  }) {
    const shift = await catalogRepository.findShiftById(params.turnoId);
    if (!shift) {
      throw new AppError(404, 'SHIFT_NOT_FOUND', `El turno ${params.turnoId} no existe.`);
    }

    const targetDate = parseDateOnlyUtc(params.fecha);
    const [sectors, compatibleTables, activeReservations] = await Promise.all([
      catalogRepository.findActiveSectors(),
      catalogRepository.findCompatibleTables({ cantidadPersonas: params.cantidadPersonas }),
      reservationRepository.findActiveByDateAndShift(targetDate, params.turnoId),
    ]);

    const occupiedTableIds = new Set(activeReservations.map((r) => r.mesaId));
    const availableTables = compatibleTables.filter((t) => !occupiedTableIds.has(t.id));

    const sectorAvailability = sectors.map((sector) => {
      const sectorTables = availableTables.filter((t) => t.sectorId === sector.id);
      const suggested = sectorTables[0] ?? null;
      return {
        sectorId: sector.id,
        nombre: sector.nombre,
        descripcion: sector.descripcion,
        availableTablesCount: sectorTables.length,
        suggestedTable: suggested
          ? {
              id: suggested.id,
              numero: suggested.numero,
              capacidadMin: suggested.capacidadMin,
              capacidadMax: suggested.capacidadMax,
            }
          : null,
      };
    });

    return {
      fecha: formatDateOnlyUtc(targetDate),
      turnoId: shift.id,
      turnoNombre: shift.nombre,
      cantidadPersonas: params.cantidadPersonas,
      hasAnyAvailability: availableTables.length > 0,
      sectors: sectorAvailability,
    };
  },
};

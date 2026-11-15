import { FormEvent, useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useHostOperations } from '../hooks/useRestoFlow';
import {
  RestoFlowApiError,
  getDefaultTodayDate,
  restoFlowApi,
} from '../services/api';
import {
  EstadoMesa,
  EstadoReserva,
  Sector,
  TableStatusView,
  Turno,
} from '../types';
import {
  ReservationStatusBadge,
  TableStatusBadge,
  WaitlistStatusBadge,
} from './StatusBadges';

interface HostDashboardProps {
  sectors: Sector[];
  shifts: Turno[];
}

const TABLE_CARD_THEME: Record<EstadoMesa, string> = {
  LIBRE: 'border-emerald-300 bg-emerald-50/70',
  RESERVADA: 'border-sky-300 bg-sky-50/70',
  OCUPADA: 'border-amber-400 bg-amber-50/80',
  MANTENIMIENTO: 'border-slate-300 bg-slate-100',
};

export function HostDashboard({ sectors, shifts }: HostDashboardProps) {
  const filterId = useId();
  const defaultShift = shifts.find((s) => s.nombre === 'Cena 1') ?? shifts[0];

  const [fecha, setFecha] = useState<string>(getDefaultTodayDate());
  const [turnoId, setTurnoId] = useState<number | null>(defaultShift?.id ?? null);
  const [sectorFilter, setSectorFilter] = useState<number | 'all'>('all');
  const [busyReservationId, setBusyReservationId] = useState<number | null>(null);
  const [busyWaitlistId, setBusyWaitlistId] = useState<number | null>(null);

  const [showAddWaitlist, setShowAddWaitlist] = useState(false);
  const [wlNombre, setWlNombre] = useState('');
  const [wlEmail, setWlEmail] = useState('');
  const [wlTelefono, setWlTelefono] = useState('');
  const [wlPersonas, setWlPersonas] = useState(2);
  const [isAddingWaitlist, setIsAddingWaitlist] = useState(false);

  const effectiveTurnoId = turnoId ?? defaultShift?.id ?? null;

  const { tablesData, reservations, waitlist, isLoading, error, refresh } =
    useHostOperations({
      fecha,
      turnoId: effectiveTurnoId,
      sectorId: sectorFilter === 'all' ? undefined : sectorFilter,
    });

  const tablesBySector = useMemo(() => {
    const groups = new Map<string, TableStatusView[]>();
    if (!tablesData) return groups;

    for (const table of tablesData.tables) {
      const existing = groups.get(table.sectorNombre) ?? [];
      existing.push(table);
      groups.set(table.sectorNombre, existing);
    }
    return groups;
  }, [tablesData]);

  const handleStatusChange = async (
    reservationId: number,
    codigo: string,
    nextEstado: EstadoReserva,
  ) => {
    setBusyReservationId(reservationId);
    try {
      const res = await restoFlowApi.updateReservationStatus(reservationId, nextEstado);
      toast.success(`Reserva ${codigo}: ${res.message}`);
      if (res.customerBlocked) {
        toast.warning(
          `Cliente ${res.reservation.cliente.nombre} bloqueado por 30 días tras acumular 2 No-Shows.`,
        );
      }
      if (res.promotedWaitlist) {
        toast.info(
          `Lista de Espera: ${res.promotedWaitlist.cliente.nombre} (#${res.promotedWaitlist.prioridad}) pasó a NOTIFICADO.`,
        );
      }
      await refresh();
    } catch (err) {
      const message =
        err instanceof RestoFlowApiError
          ? err.message
          : 'No pudimos actualizar el estado de la reserva.';
      toast.error(message);
    } finally {
      setBusyReservationId(null);
    }
  };

  const handleConvertWaitlist = async (waitlistId: number, guestName: string) => {
    setBusyWaitlistId(waitlistId);
    try {
      const res = await restoFlowApi.convertWaitlist(waitlistId, {
        sectorId: sectorFilter === 'all' ? undefined : sectorFilter,
      });
      toast.success(
        `${guestName} convertido a reserva ${res.reservation.codigo} en mesa ${res.reservation.mesa.numero}.`,
      );
      await refresh();
    } catch (err) {
      const message =
        err instanceof RestoFlowApiError
          ? err.message
          : 'No hay mesas disponibles compatibles para convertir esta solicitud.';
      toast.error(message);
    } finally {
      setBusyWaitlistId(null);
    }
  };

  const handleAddWalkInWaitlist = async (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveTurnoId) return;

    setIsAddingWaitlist(true);
    try {
      const entry = await restoFlowApi.joinWaitlist({
        fecha,
        turnoId: effectiveTurnoId,
        cantidadPersonas: wlPersonas,
        nombre: wlNombre.trim(),
        email: wlEmail.trim(),
        telefono: wlTelefono.trim(),
      });
      toast.success(
        `${entry.cliente.nombre} anotado en Lista de Espera (prioridad #${entry.prioridad}).`,
      );
      setWlNombre('');
      setWlEmail('');
      setWlTelefono('');
      setWlPersonas(2);
      setShowAddWaitlist(false);
      await refresh();
    } catch (err) {
      const message =
        err instanceof RestoFlowApiError
          ? err.message
          : 'No pudimos agregar al comensal a la lista de espera.';
      toast.error(message);
    } finally {
      setIsAddingWaitlist(false);
    }
  };

  const metrics = tablesData?.metrics;

  return (
    <div className="space-y-6">
      {/* Barra superior operativa */}
      <section
        aria-labelledby={`${filterId}-host-title`}
        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              id={`${filterId}-host-title`}
              className="text-2xl font-bold tracking-tight text-stone-900"
            >
              Host Dashboard Operativo
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Mapa de mesas en vivo, check-in de comensales y gestión de lista de espera.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${filterId}-fecha`} className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              Fecha operativa
            </label>
            <input
              id={`${filterId}-fecha`}
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${filterId}-turno`} className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              Turno
            </label>
            <select
              id={`${filterId}-turno`}
              value={effectiveTurnoId ?? ''}
              onChange={(e) => setTurnoId(Number(e.target.value))}
              className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.nombre} ({shift.horaInicio}–{shift.horaFin})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${filterId}-sector`} className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              Sector
            </label>
            <select
              id={`${filterId}-sector`}
              value={sectorFilter}
              onChange={(e) =>
                setSectorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              <option value="all">Todos los sectores</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Métricas rápidas */}
      {metrics && (
        <section aria-label="Métricas del turno" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Ocupación del turno
            </p>
            <p className="mt-1.5 text-3xl font-extrabold text-stone-900 tabular-nums">
              {metrics.occupancyPercentage}%
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {metrics.reservedTables + metrics.occupiedTables} de {metrics.activeTables} mesas activas
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Mesas Libres
            </p>
            <p className="mt-1.5 text-3xl font-extrabold text-emerald-700 tabular-nums">
              {metrics.freeTables}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {metrics.maintenanceTables} en mantenimiento
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Reservadas / Sentadas
            </p>
            <p className="mt-1.5 text-3xl font-extrabold text-sky-800 tabular-nums">
              {metrics.reservedTables}{' '}
              <span className="text-lg font-bold text-amber-700">/ {metrics.occupiedTables}</span>
            </p>
            <p className="mt-1 text-xs text-stone-600">Azul reservadas · Naranja en curso</p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Cubiertos Reservados vs. Libres
            </p>
            <p className="mt-1.5 text-3xl font-extrabold text-stone-900 tabular-nums">
              {metrics.reservedCovers}{' '}
              <span className="text-lg font-semibold text-stone-500">/ {metrics.freeCovers}</span>
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Capacidad activa total: {metrics.totalCapacity} cubiertos
            </p>
          </div>
        </section>
      )}

      {/* Cuerpo principal: Mapa de Mesas + Tabla a la izquierda, Lista de Espera a la derecha */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Mapa visual de mesas por sector */}
          <section
            aria-labelledby={`${filterId}-map-title`}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${filterId}-map-title`} className="text-lg font-bold text-stone-900">
                Mapa de Mesas por Sector
              </h2>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-stone-700">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
                  Libre
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-600" aria-hidden="true" />
                  Reservada
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-600" aria-hidden="true" />
                  Ocupada
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-500" aria-hidden="true" />
                  Bloqueada
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-6">
              {Array.from(tablesBySector.entries()).map(([sectorNombre, sectorTables]) => (
                <div key={sectorNombre}>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-stone-600">
                    {sectorNombre}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {sectorTables.map((table) => {
                      const active = table.activeReservation;
                      const isBusy = active !== null && busyReservationId === active.id;

                      return (
                        <article
                          key={table.id}
                          className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                            TABLE_CARD_THEME[table.estadoOperativo]
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-base font-bold text-stone-900">
                                  Mesa {table.numero}
                                </h4>
                                <p className="text-xs font-medium text-stone-600">
                                  Capacidad: {table.capacidadMin}–{table.capacidadMax} personas
                                </p>
                              </div>
                              <TableStatusBadge status={table.estadoOperativo} />
                            </div>

                            {active ? (
                              <div className="mt-3 rounded-lg border border-stone-200/80 bg-white/90 p-3 text-xs text-stone-800">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-bold text-orange-800">
                                    {active.codigo}
                                  </span>
                                  <span className="font-semibold">
                                    {active.cantidadPersonas}{' '}
                                    {active.cantidadPersonas === 1 ? 'persona' : 'personas'}
                                  </span>
                                </div>
                                <p className="mt-1 font-semibold text-stone-900">
                                  {active.clienteNombre}
                                </p>
                                {active.notas && (
                                  <p className="mt-0.5 text-stone-600 italic">“{active.notas}”</p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-3 text-xs text-stone-600">
                                {table.estadoOperativo === 'MANTENIMIENTO'
                                  ? 'Mesa fuera de servicio para este turno.'
                                  : 'Disponible para asignación inmediata.'}
                              </p>
                            )}
                          </div>

                          {active && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(active.estado === 'CONFIRMADA' ||
                                active.estado === 'PENDIENTE') && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    aria-label={`Sentar Comensal en mesa ${table.numero} (${active.codigo})`}
                                    onClick={() =>
                                      void handleStatusChange(
                                        active.id,
                                        active.codigo,
                                        'EN_CURSO',
                                      )
                                    }
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                                  >
                                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Sentar Comensal</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    aria-label={`Marcar No-Show de mesa ${table.numero} (${active.codigo})`}
                                    onClick={() =>
                                      void handleStatusChange(
                                        active.id,
                                        active.codigo,
                                        'NO_SHOW',
                                      )
                                    }
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"
                                  >
                                    <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Marcar No-Show</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    aria-label={`Cancelar reserva de mesa ${table.numero} (${active.codigo})`}
                                    onClick={() =>
                                      void handleStatusChange(
                                        active.id,
                                        active.codigo,
                                        'CANCELADA',
                                      )
                                    }
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                                  >
                                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Cancelar</span>
                                  </button>
                                </>
                              )}

                              {active.estado === 'EN_CURSO' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  aria-label={`Liberar Mesa ${table.numero} (${active.codigo})`}
                                  onClick={() =>
                                    void handleStatusChange(
                                      active.id,
                                      active.codigo,
                                      'COMPLETADA',
                                    )
                                  }
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Liberar Mesa</span>
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tabla/Timeline de Reservas del Turno */}
          <section
            aria-labelledby={`${filterId}-reservations-title`}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6"
          >
            <h2 id={`${filterId}-reservations-title`} className="text-lg font-bold text-stone-900">
              Reservas del Turno ({reservations.length})
            </h2>

            {reservations.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
                No hay reservas registradas para esta fecha y turno.
              </p>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby="reservations-table-caption"
                className="table-wrapper mt-4 rounded-xl border border-stone-200"
              >
                <table className="rf-table text-left text-sm">
                  <caption id="reservations-table-caption" className="sr-only">
                    Listado de reservas registradas para la fecha {fecha}
                  </caption>
                  <thead className="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-700">
                    <tr>
                      <th scope="col" className="px-3 py-2.5">
                        Código
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Comensal
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Mesa / Sector
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Pers.
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Estado
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {reservations.map((res) => {
                      const isBusy = busyReservationId === res.id;
                      return (
                        <tr key={res.id} className="hover:bg-stone-50">
                          <th
                            scope="row"
                            className="px-3 py-2.5 font-mono font-bold whitespace-nowrap text-orange-800"
                          >
                            {res.codigo}
                          </th>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-stone-900">{res.cliente.nombre}</div>
                            <div className="text-xs text-stone-600">{res.cliente.email}</div>
                          </td>
                          <td className="px-3 py-2.5 text-stone-700">
                            <div className="font-semibold text-stone-900">Mesa {res.mesa.numero}</div>
                            <div className="text-xs text-stone-600">{res.mesa.sectorNombre}</div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-stone-900 tabular-nums">
                            {res.cantidadPersonas}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <ReservationStatusBadge status={res.estado} />
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {(res.estado === 'CONFIRMADA' || res.estado === 'PENDIENTE') && (
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  aria-label={`Sentar Comensal de reserva ${res.codigo}`}
                                  onClick={() =>
                                    void handleStatusChange(res.id, res.codigo, 'EN_CURSO')
                                  }
                                  className="rounded-lg bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                                >
                                  Sentar
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  aria-label={`Marcar No-Show de reserva ${res.codigo}`}
                                  onClick={() =>
                                    void handleStatusChange(res.id, res.codigo, 'NO_SHOW')
                                  }
                                  className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"
                                >
                                  No-Show
                                </button>
                              </div>
                            )}
                            {res.estado === 'EN_CURSO' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                aria-label={`Liberar Mesa de reserva ${res.codigo}`}
                                onClick={() =>
                                  void handleStatusChange(res.id, res.codigo, 'COMPLETADA')
                                }
                                className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                              >
                                Liberar
                              </button>
                            )}
                            {(res.estado === 'COMPLETADA' ||
                              res.estado === 'CANCELADA' ||
                              res.estado === 'NO_SHOW') && (
                              <span className="text-xs text-stone-500">Sin acciones</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Panel Lateral: Lista de Espera */}
        <aside
          aria-label="Lista de Espera del Turno"
          className="h-fit rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-700" aria-hidden="true" />
              <h2 className="text-lg font-bold text-stone-900">
                Lista de Espera ({waitlist.length})
              </h2>
            </div>
            <button
              type="button"
              aria-expanded={showAddWaitlist}
              onClick={() => setShowAddWaitlist((prev) => !prev)}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Walk-in</span>
            </button>
          </div>

          {showAddWaitlist && (
            <form
              onSubmit={handleAddWalkInWaitlist}
              className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4"
            >
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-700">
                Nuevo ingreso a Lista de Espera
              </h3>
              <div>
                <label htmlFor={`${filterId}-wl-nombre`} className="block text-xs font-semibold text-stone-700">
                  Nombre
                </label>
                <input
                  id={`${filterId}-wl-nombre`}
                  type="text"
                  required
                  value={wlNombre}
                  onChange={(e) => setWlNombre(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`${filterId}-wl-email`} className="block text-xs font-semibold text-stone-700">
                  Email
                </label>
                <input
                  id={`${filterId}-wl-email`}
                  type="email"
                  required
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={wlEmail}
                  onChange={(e) => setWlEmail(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`${filterId}-wl-tel`} className="block text-xs font-semibold text-stone-700">
                    Teléfono
                  </label>
                  <input
                    id={`${filterId}-wl-tel`}
                    type="tel"
                    required
                    value={wlTelefono}
                    onChange={(e) => setWlTelefono(e.target.value)}
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`${filterId}-wl-pers`} className="block text-xs font-semibold text-stone-700">
                    Personas
                  </label>
                  <input
                    id={`${filterId}-wl-pers`}
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={wlPersonas}
                    onChange={(e) => setWlPersonas(Number(e.target.value))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isAddingWaitlist}
                className="min-h-10 w-full rounded-lg bg-orange-700 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
              >
                {isAddingWaitlist ? 'Anotando...' : 'Agregar a Lista'}
              </button>
            </form>
          )}

          <div className="mt-4 space-y-3">
            {waitlist.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-300 p-5 text-center text-sm text-stone-600">
                No hay clientes en espera para este turno.
              </p>
            ) : (
              waitlist.map((entry) => {
                const canConvert =
                  entry.estado === 'EN_ESPERA' || entry.estado === 'NOTIFICADO';
                const isBusy = busyWaitlistId === entry.id;

                return (
                  <article
                    key={entry.id}
                    className="rounded-xl border border-stone-200 bg-stone-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block rounded-md bg-stone-200 px-2 py-0.5 font-mono text-xs font-bold text-stone-800">
                          FIFO #{entry.prioridad}
                        </span>
                        <h3 className="mt-1.5 text-sm font-bold text-stone-900">
                          {entry.cliente.nombre}
                        </h3>
                      </div>
                      <WaitlistStatusBadge status={entry.estado} />
                    </div>

                    <p className="mt-1.5 text-xs text-stone-600">
                      {entry.cantidadPersonas}{' '}
                      {entry.cantidadPersonas === 1 ? 'persona' : 'personas'} ·{' '}
                      {entry.cliente.telefono}
                    </p>
                    <p className="text-xs text-stone-600">{entry.cliente.email}</p>

                    {canConvert && (
                      <button
                        type="button"
                        disabled={isBusy}
                        aria-label={`Convertir en Reserva a ${entry.cliente.nombre} (prioridad ${entry.prioridad})`}
                        onClick={() => void handleConvertWaitlist(entry.id, entry.cliente.nombre)}
                        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isBusy ? 'Asignando mesa...' : 'Convertir en Reserva'}</span>
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

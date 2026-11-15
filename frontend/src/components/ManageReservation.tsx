import { FormEvent, useId, useRef, useState } from 'react';
import { AlertCircle, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { RestoFlowApiError, restoFlowApi } from '../services/api';
import { Reservation } from '../types';
import { ReservationStatusBadge } from './StatusBadges';

interface ManageReservationProps {
  recentReservation: Reservation | null;
  initialLookup?: { codigo: string; email: string } | null;
}

export function ManageReservation({
  recentReservation,
  initialLookup,
}: ManageReservationProps) {
  const formId = useId();
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  const [codigo, setCodigo] = useState(initialLookup?.codigo ?? '');
  const [email, setEmail] = useState(initialLookup?.email ?? '');
  const [reservation, setReservation] = useState<Reservation | null>(
    initialLookup && recentReservation?.codigo === initialLookup.codigo ? recentReservation : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [promotedNotice, setPromotedNotice] = useState<string | null>(null);

  const executeLookup = async (targetCode: string, targetEmail: string) => {
    setError(null);
    setPromotedNotice(null);
    setIsSearching(true);
    try {
      const found = await restoFlowApi.lookupReservation(targetCode, targetEmail);
      setReservation(found);
    } catch (err) {
      setReservation(null);
      const message =
        err instanceof RestoFlowApiError
          ? err.message
          : 'No pudimos consultar tu reserva en este momento.';
      setError(message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || !email.trim()) {
      setError('Ingresá tanto tu código de reserva (ej. RF-4821) como tu correo electrónico.');
      return;
    }
    await executeLookup(codigo, email);
  };

  const handleConfirmCancel = async () => {
    if (!reservation) return;
    setIsCancelling(true);
    try {
      const result = await restoFlowApi.cancelByCode(
        reservation.codigo,
        reservation.cliente.email,
      );
      setReservation(result.reservation);
      confirmDialogRef.current?.close();
      toast.success(`Reserva ${result.reservation.codigo} cancelada.`);
      if (result.promotedWaitlist) {
        setPromotedNotice(
          `Mesa liberada: el cliente ${result.promotedWaitlist.cliente.nombre} en Lista de Espera fue notificado automáticamente.`,
        );
      }
    } catch (err) {
      const message =
        err instanceof RestoFlowApiError
          ? err.message
          : 'No pudimos cancelar la reserva.';
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel =
    reservation !== null &&
    (reservation.estado === 'CONFIRMADA' || reservation.estado === 'PENDIENTE');

  return (
    <section aria-labelledby={`${formId}-manage-title`} className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <h1
          id={`${formId}-manage-title`}
          className="text-2xl font-bold tracking-tight text-stone-900"
        >
          Gestionar mi Reserva
        </h1>
        <p className="mt-1.5 text-sm text-stone-600">
          Consultá el estado de tu mesa o cancelá con un clic usando tu código y correo.
        </p>

        {recentReservation && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
            <span>
              Última reserva creada en esta sesión:{' '}
              <strong className="font-mono">{recentReservation.codigo}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setCodigo(recentReservation.codigo);
                setEmail(recentReservation.cliente.email);
                void executeLookup(recentReservation.codigo, recentReservation.cliente.email);
              }}
              className="rounded-lg bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-800"
            >
              Cargar datos
            </button>
          </div>
        )}

        <search className="mt-6">
          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-codigo`} className="text-sm font-semibold text-stone-800">
                Código de reserva
              </label>
              <input
                id={`${formId}-codigo`}
                name="codigo"
                type="text"
                required
                placeholder="RF-4821"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 font-mono text-base text-stone-900 uppercase"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-email`} className="text-sm font-semibold text-stone-800">
                Correo electrónico
              </label>
              <input
                id={`${formId}-email`}
                name="email"
                type="email"
                required
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="camila.soto@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSearching}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60 sm:w-auto"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>{isSearching ? 'Buscando...' : 'Buscar Reserva'}</span>
              </button>
            </div>
          </form>
        </search>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {promotedNotice && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm font-medium text-sky-950"
          >
            {promotedNotice}
          </div>
        )}

        {reservation && (
          <article className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Reserva encontrada
                </span>
                <h2 className="mt-0.5 font-mono text-2xl font-bold text-stone-900">
                  {reservation.codigo}
                </h2>
              </div>
              <ReservationStatusBadge status={reservation.estado} />
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-stone-500">Titular</dt>
                <dd className="mt-0.5 font-semibold text-stone-900">
                  {reservation.cliente.nombre}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-500">Fecha y Turno</dt>
                <dd className="mt-0.5 font-semibold text-stone-900">
                  {reservation.fecha} · {reservation.turno.nombre} ({reservation.turno.horaInicio})
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-500">Sector y Mesa asignada</dt>
                <dd className="mt-0.5 font-semibold text-stone-900">
                  {reservation.mesa.sectorNombre} · Mesa {reservation.mesa.numero}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-500">Comensales</dt>
                <dd className="mt-0.5 font-semibold text-stone-900">
                  {reservation.cantidadPersonas}{' '}
                  {reservation.cantidadPersonas === 1 ? 'persona' : 'personas'}
                </dd>
              </div>
              {reservation.notas && (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-stone-500">Notas</dt>
                  <dd className="mt-0.5 text-stone-800">{reservation.notas}</dd>
                </div>
              )}
            </dl>

            {canCancel && (
              <div className="mt-6 border-t border-stone-200 pt-4">
                <button
                  type="button"
                  onClick={() => confirmDialogRef.current?.showModal()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Cancelar Reserva</span>
                </button>
              </div>
            )}
          </article>
        )}
      </div>

      {/* Diálogo nativo modal de confirmación */}
      <dialog
        ref={confirmDialogRef}
        aria-labelledby={`${formId}-cancel-dialog-title`}
        className="rf-dialog rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
      >
        <h2 id={`${formId}-cancel-dialog-title`} className="text-lg font-bold text-stone-900">
          ¿Cancelar reserva {reservation?.codigo}?
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          La mesa {reservation?.mesa.numero} volverá a quedar libre para otros comensales y el
          primer cliente compatible en lista de espera será notificado automáticamente.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => confirmDialogRef.current?.close()}
            className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100"
          >
            Mantener reserva
          </button>
          <button
            type="button"
            disabled={isCancelling}
            onClick={handleConfirmCancel}
            className="min-h-11 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
          >
            {isCancelling ? 'Cancelando...' : 'Confirmar Cancelación'}
          </button>
        </div>
      </dialog>
    </section>
  );
}

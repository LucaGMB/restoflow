import { FormEvent, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  RestoFlowApiError,
  getDefaultTodayDate,
  restoFlowApi,
} from '../services/api';
import {
  AvailabilityResponse,
  Reservation,
  Turno,
  WaitlistEntry,
} from '../types';

interface ReservationWizardProps {
  shifts: Turno[];
  onReservationCreated: (reservation: Reservation) => void;
  onGoToManage: (reservation: Reservation) => void;
}

type WizardStep = 1 | 2 | 3 | 'success';
type ContactField = 'nombre' | 'email' | 'telefono';

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function ReservationWizard({
  shifts,
  onReservationCreated,
  onGoToManage,
}: ReservationWizardProps) {
  const formId = useId();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>(1);
  const [fecha, setFecha] = useState<string>(getDefaultTodayDate());
  const [cantidadPersonas, setCantidadPersonas] = useState<number>(2);
  const [turnoId, setTurnoId] = useState<number>(shifts[0]?.id ?? 1);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<number | 'any' | null>(null);
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');

  const [touched, setTouched] = useState<Record<ContactField, boolean>>({
    nombre: false,
    email: false,
    telefono: false,
  });
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [submitError, setSubmitError] = useState<{
    message: string;
    canJoinWaitlist?: boolean;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);
  const [waitlistTicket, setWaitlistTicket] = useState<WaitlistEntry | null>(null);

  const selectedShift = shifts.find((s) => s.id === turnoId) ?? shifts[0];

  const moveFocusToStepHeading = () => {
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
  };

  const validateField = (field: ContactField, value: string): string | undefined => {
    const trimmed = value.trim();
    if (field === 'nombre' && trimmed.length < 2) {
      return 'Ingresá tu nombre completo (mínimo 2 caracteres).';
    }
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Ingresá un correo electrónico válido (ej. nombre@example.com).';
    }
    if (field === 'telefono' && trimmed.length < 6) {
      return 'Ingresá un teléfono de contacto válido (mínimo 6 caracteres).';
    }
    return undefined;
  };

  const handleFieldBlur = (field: ContactField, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleFieldChange = (field: ContactField, value: string) => {
    if (field === 'nombre') setNombre(value);
    if (field === 'email') setEmail(value);
    if (field === 'telefono') setTelefono(value);

    // Clear existing error immediately as user fixes input
    if (errors[field]) {
      const nextErr = validateField(field, value);
      if (!nextErr) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    }
  };

  const handleCheckAvailability = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;

    setIsLoadingAvailability(true);
    setSubmitError(null);
    try {
      const result = await restoFlowApi.checkAvailability({
        fecha,
        turnoId: selectedShift.id,
        cantidadPersonas,
      });
      setAvailability(result);
      const firstAvailable = result.sectors.find((s) => s.availableTablesCount > 0);
      setSelectedSectorId(firstAvailable ? firstAvailable.sectorId : null);
      setIsWaitlistMode(!result.hasAnyAvailability);
      setStep(2);
      moveFocusToStepHeading();
    } catch (err) {
      const message =
        err instanceof RestoFlowApiError
          ? err.message
          : 'No pudimos consultar la disponibilidad para ese turno.';
      toast.error(message);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const handleProceedToContact = (waitlist: boolean) => {
    setIsWaitlistMode(waitlist);
    setSubmitError(null);
    setStep(3);
    moveFocusToStepHeading();
  };

  const handleFinalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const nombreErr = validateField('nombre', nombre);
    const emailErr = validateField('email', email);
    const telefonoErr = validateField('telefono', telefono);

    const nextErrors: Partial<Record<ContactField, string>> = {
      nombre: nombreErr,
      email: emailErr,
      telefono: telefonoErr,
    };
    setTouched({ nombre: true, email: true, telefono: true });
    setErrors(nextErrors);

    if (nombreErr) {
      nombreRef.current?.focus();
      return;
    }
    if (emailErr) {
      emailRef.current?.focus();
      return;
    }
    if (telefonoErr) {
      telefonoRef.current?.focus();
      return;
    }

    if (!selectedShift) return;

    setIsSubmitting(true);
    try {
      if (isWaitlistMode) {
        const entry = await restoFlowApi.joinWaitlist({
          fecha,
          turnoId: selectedShift.id,
          cantidadPersonas,
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
        });
        setWaitlistTicket(entry);
        setConfirmedReservation(null);
        setStep('success');
        toast.success('Te anotamos en la lista de espera.');
        moveFocusToStepHeading();
        return;
      }

      const reservation = await restoFlowApi.createReservation({
        fecha,
        turnoId: selectedShift.id,
        sectorId: typeof selectedSectorId === 'number' ? selectedSectorId : undefined,
        cantidadPersonas,
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        notas: notas.trim() || undefined,
      });

      setConfirmedReservation(reservation);
      setWaitlistTicket(null);
      setStep('success');
      onReservationCreated(reservation);
      toast.success(`Reserva ${reservation.codigo} confirmada.`);
      moveFocusToStepHeading();
    } catch (err) {
      if (err instanceof RestoFlowApiError) {
        const canJoinWaitlist = Boolean(err.details?.canJoinWaitlist);
        setSubmitError({ message: err.message, canJoinWaitlist });
        toast.error(err.message);
      } else {
        const fallback = 'Ocurrió un error al procesar tu solicitud.';
        setSubmitError({ message: fallback });
        toast.error(fallback);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setAvailability(null);
    setSelectedSectorId(null);
    setIsWaitlistMode(false);
    setConfirmedReservation(null);
    setWaitlistTicket(null);
    setSubmitError(null);
    setErrors({});
    setTouched({ nombre: false, email: false, telefono: false });
    setNotas('');
    moveFocusToStepHeading();
  };

  const activeStepNumber = step === 'success' ? 3 : step;

  return (
    <section aria-labelledby={`${formId}-wizard-title`} className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 border-b border-stone-200 pb-6">
          <h1
            id={`${formId}-wizard-title`}
            className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl"
          >
            Reservá tu mesa en segundos
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Asignación automática de mesa óptima según grupo, turno y sector preferido.
          </p>

          <nav aria-label="Progreso de reserva" className="mt-6">
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { num: 1, title: '1. Fecha y Turno' },
                { num: 2, title: '2. Sector y Mesa' },
                { num: 3, title: '3. Tus Datos' },
              ].map((item) => {
                const isActive = step === item.num;
                const isDone = activeStepNumber > item.num || step === 'success';
                return (
                  <li
                    key={item.num}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-orange-600 bg-orange-50 text-orange-950'
                        : isDone
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 bg-stone-50 text-stone-600'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-orange-700 text-white'
                          : isDone
                            ? 'bg-emerald-700 text-white'
                            : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {isDone ? '✓' : item.num}
                    </span>
                    <span>{item.title}</span>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {/* Paso 1: Fecha, Comensales y Turno */}
        {step === 1 && (
          <form onSubmit={handleCheckAvailability} noValidate>
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-lg font-semibold text-stone-900 focus:outline-none"
            >
              Paso 1: Elegí fecha, comensales y turno
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${formId}-fecha`}
                  className="flex items-center gap-2 text-sm font-semibold text-stone-800"
                >
                  <Calendar className="h-4 w-4 text-orange-700" aria-hidden="true" />
                  <span>Fecha de reserva</span>
                </label>
                <input
                  id={`${formId}-fecha`}
                  name="fecha"
                  type="date"
                  required
                  min={getDefaultTodayDate()}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900 shadow-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${formId}-personas`}
                  className="flex items-center gap-2 text-sm font-semibold text-stone-800"
                >
                  <Users className="h-4 w-4 text-orange-700" aria-hidden="true" />
                  <span>Cantidad de personas</span>
                </label>
                <select
                  id={`${formId}-personas`}
                  name="cantidadPersonas"
                  value={cantidadPersonas}
                  onChange={(e) => setCantidadPersonas(Number(e.target.value))}
                  className="min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900 shadow-xs"
                >
                  {GUEST_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'persona' : 'personas'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="mt-6">
              <legend className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                <Clock className="h-4 w-4 text-orange-700" aria-hidden="true" />
                <span>Seleccioná el turno de servicio</span>
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {shifts.map((shift) => {
                  const inputId = `${formId}-shift-${shift.id}`;
                  const checked = (selectedShift?.id ?? 0) === shift.id;
                  return (
                    <label
                      key={shift.id}
                      htmlFor={inputId}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                        checked
                          ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name="turnoId"
                        value={shift.id}
                        checked={checked}
                        onChange={() => setTurnoId(shift.id)}
                        className="mt-1 h-4 w-4 accent-orange-700"
                      />
                      <div>
                        <span className="block text-sm font-semibold text-stone-900">
                          {shift.nombre}
                        </span>
                        <span className="mt-0.5 block text-xs font-medium text-stone-600 tabular-nums">
                          {shift.horaInicio} – {shift.horaFin}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={isLoadingAvailability || shifts.length === 0}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-700 px-6 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isLoadingAvailability ? 'Consultando...' : 'Ver Disponibilidad'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}

        {/* Paso 2: Selección de Sector y Disponibilidad */}
        {step === 2 && availability && (
          <div>
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-lg font-semibold text-stone-900 focus:outline-none"
            >
              Paso 2: Elegí tu sector preferido
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Disponibilidad en tiempo real para{' '}
              <strong className="font-semibold text-stone-900">
                {availability.cantidadPersonas}{' '}
                {availability.cantidadPersonas === 1 ? 'persona' : 'personas'}
              </strong>{' '}
              el <strong className="font-semibold text-stone-900">{availability.fecha}</strong> en{' '}
              <strong className="font-semibold text-stone-900">{availability.turnoNombre}</strong>.
            </p>

            {availability.hasAnyAvailability ? (
              <fieldset className="mt-5">
                <legend className="sr-only">Sectores disponibles</legend>
                <div className="grid grid-cols-1 gap-3">
                  {availability.sectors.map((sector) => {
                    const isAvailable = sector.availableTablesCount > 0;
                    const isSelected = selectedSectorId === sector.sectorId;
                    const radioId = `${formId}-sector-${sector.sectorId}`;

                    return (
                      <label
                        key={sector.sectorId}
                        htmlFor={radioId}
                        className={`flex items-start justify-between gap-4 rounded-xl border p-4 transition-colors ${
                          !isAvailable
                            ? 'cursor-not-allowed border-stone-200 bg-stone-100 opacity-75'
                            : isSelected
                              ? 'cursor-pointer border-orange-600 bg-orange-50 ring-1 ring-orange-600'
                              : 'cursor-pointer border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            id={radioId}
                            type="radio"
                            name="sectorId"
                            disabled={!isAvailable}
                            checked={isSelected}
                            onChange={() => setSelectedSectorId(sector.sectorId)}
                            className="mt-1 h-4 w-4 accent-orange-700"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-orange-700" aria-hidden="true" />
                              <span className="font-semibold text-stone-900">{sector.nombre}</span>
                            </div>
                            <p className="mt-1 text-sm text-stone-600">{sector.descripcion}</p>
                            {sector.suggestedTable && (
                              <p className="mt-1.5 text-xs font-medium text-emerald-800">
                                Mesa óptima sugerida: {sector.suggestedTable.numero} (cap.{' '}
                                {sector.suggestedTable.capacidadMin}–{sector.suggestedTable.capacidadMax}{' '}
                                pers.)
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                            isAvailable
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {isAvailable
                            ? `${sector.availableTablesCount} ${
                                sector.availableTablesCount === 1 ? 'mesa libre' : 'mesas libres'
                              }`
                            : 'Sin lugar'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <div
                role="status"
                className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">Turno completo para {cantidadPersonas} personas</h3>
                    <p className="mt-1 text-sm text-amber-900">
                      No quedan mesas libres en este horario, pero podés anotarte en nuestra{' '}
                      <strong>Lista de Espera prioritaria</strong> y te avisaremos apenas se libere
                      una mesa compatible.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  moveFocusToStepHeading();
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Volver</span>
              </button>

              <div className="flex flex-wrap items-center gap-3">
                {availability.hasAnyAvailability ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleProceedToContact(true)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
                    >
                      <span>Preferir Lista de Espera</span>
                    </button>
                    <button
                      type="button"
                      disabled={selectedSectorId === null}
                      onClick={() => handleProceedToContact(false)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-700 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>Continuar con Reserva</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleProceedToContact(true)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-700 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-800"
                  >
                    <span>Anotarme en Lista de Espera</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Paso 3: Datos de Contacto y Confirmación */}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit} noValidate>
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-lg font-semibold text-stone-900 focus:outline-none"
            >
              {isWaitlistMode
                ? 'Paso 3: Anotarte en Lista de Espera'
                : 'Paso 3: Completá tus datos para confirmar'}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {fecha} · {selectedShift?.nombre} ({selectedShift?.horaInicio}) · {cantidadPersonas}{' '}
              {cantidadPersonas === 1 ? 'persona' : 'personas'}
            </p>

            {submitError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-semibold">{submitError.message}</p>
                    {submitError.canJoinWaitlist && !isWaitlistMode && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsWaitlistMode(true);
                          setSubmitError(null);
                        }}
                        className="mt-2 inline-flex items-center rounded-lg bg-rose-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-900"
                      >
                        Cambiar a Lista de Espera para este turno
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor={`${formId}-nombre`} className="text-sm font-semibold text-stone-800">
                  Nombre completo <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={nombreRef}
                  id={`${formId}-nombre`}
                  name="nombre"
                  type="text"
                  required
                  autoComplete="name"
                  enterKeyHint="next"
                  value={nombre}
                  onChange={(e) => handleFieldChange('nombre', e.target.value)}
                  onBlur={(e) => handleFieldBlur('nombre', e.target.value)}
                  aria-invalid={touched.nombre && Boolean(errors.nombre) ? 'true' : undefined}
                  aria-describedby={errors.nombre ? `${formId}-nombre-err` : undefined}
                  className="min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900"
                />
                {touched.nombre && errors.nombre && (
                  <p id={`${formId}-nombre-err`} className="text-xs font-medium text-rose-700">
                    {errors.nombre}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-email`} className="text-sm font-semibold text-stone-800">
                  Correo electrónico <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={emailRef}
                  id={`${formId}-email`}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  onBlur={(e) => handleFieldBlur('email', e.target.value)}
                  aria-invalid={touched.email && Boolean(errors.email) ? 'true' : undefined}
                  aria-describedby={`${formId}-email-hint ${
                    errors.email ? `${formId}-email-err` : ''
                  }`.trim()}
                  className="min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900"
                />
                <span id={`${formId}-email-hint`} className="text-xs text-stone-600">
                  Lo usarás junto con tu código para consultar o cancelar.
                </span>
                {touched.email && errors.email && (
                  <p id={`${formId}-email-err`} className="text-xs font-medium text-rose-700">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-telefono`} className="text-sm font-semibold text-stone-800">
                  Teléfono <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={telefonoRef}
                  id={`${formId}-telefono`}
                  name="telefono"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  enterKeyHint={isWaitlistMode ? 'done' : 'next'}
                  value={telefono}
                  onChange={(e) => handleFieldChange('telefono', e.target.value)}
                  onBlur={(e) => handleFieldBlur('telefono', e.target.value)}
                  aria-invalid={touched.telefono && Boolean(errors.telefono) ? 'true' : undefined}
                  aria-describedby={errors.telefono ? `${formId}-tel-err` : undefined}
                  className="min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900"
                />
                {touched.telefono && errors.telefono && (
                  <p id={`${formId}-tel-err`} className="text-xs font-medium text-rose-700">
                    {errors.telefono}
                  </p>
                )}
              </div>

              {!isWaitlistMode && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor={`${formId}-notas`} className="text-sm font-semibold text-stone-800">
                    Notas o preferencias (opcional)
                  </label>
                  <textarea
                    id={`${formId}-notas`}
                    name="notas"
                    rows={3}
                    maxLength={400}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Alergias, ocasión especial, silla para bebé..."
                    className="rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900"
                  />
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  moveFocusToStepHeading();
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Volver</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-700 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isSubmitting
                    ? 'Procesando...'
                    : isWaitlistMode
                      ? 'Confirmar Lista de Espera'
                      : 'Confirmar Reserva'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Pantalla de Éxito */}
        {step === 'success' && confirmedReservation && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8">
            <div className="flex items-center gap-3 text-emerald-900">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-bold focus:outline-none"
                >
                  ¡Reserva confirmada!
                </h2>
                <p className="text-sm text-emerald-800">
                  Guardá tu código para consultar o modificar tu reserva.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-emerald-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Código de reserva
                  </span>
                  <p className="mt-0.5 font-mono text-3xl font-extrabold tracking-wider text-orange-700 tabular-nums">
                    {confirmedReservation.codigo}
                  </p>
                </div>
                <span className="rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-bold text-sky-900">
                  {confirmedReservation.estado}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-stone-500">Fecha y Turno</dt>
                  <dd className="mt-0.5 font-semibold text-stone-900">
                    {confirmedReservation.fecha} · {confirmedReservation.turno.nombre} (
                    {confirmedReservation.turno.horaInicio})
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-stone-500">Sector y Mesa</dt>
                  <dd className="mt-0.5 font-semibold text-stone-900">
                    {confirmedReservation.mesa.sectorNombre} · Mesa {confirmedReservation.mesa.numero}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-stone-500">Comensales</dt>
                  <dd className="mt-0.5 font-semibold text-stone-900">
                    {confirmedReservation.cantidadPersonas}{' '}
                    {confirmedReservation.cantidadPersonas === 1 ? 'persona' : 'personas'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-stone-500">Titular</dt>
                  <dd className="mt-0.5 font-semibold text-stone-900">
                    {confirmedReservation.cliente.nombre} ({confirmedReservation.cliente.email})
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onGoToManage(confirmedReservation)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
              >
                <span>Gestionar o Cancelar Reserva</span>
              </button>
              <button
                type="button"
                onClick={resetWizard}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              >
                <span>Hacer otra reserva</span>
              </button>
            </div>
          </div>
        )}

        {step === 'success' && waitlistTicket && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
            <div className="flex items-center gap-3 text-amber-950">
              <Clock className="h-8 w-8 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-bold focus:outline-none"
                >
                  ¡Ingresaste a la Lista de Espera!
                </h2>
                <p className="text-sm text-amber-900">
                  Prioridad asignada: <strong>#{waitlistTicket.prioridad}</strong> en orden de llegada.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4 text-sm text-stone-800">
              <p>
                <strong>Fecha y Turno:</strong> {waitlistTicket.fecha} · {waitlistTicket.turnoNombre}{' '}
                ({waitlistTicket.horaInicio})
              </p>
              <p className="mt-1">
                <strong>Grupo:</strong> {waitlistTicket.cantidadPersonas} personas ·{' '}
                {waitlistTicket.cliente.nombre} ({waitlistTicket.cliente.email})
              </p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={resetWizard}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800"
              >
                <span>Volver al inicio</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

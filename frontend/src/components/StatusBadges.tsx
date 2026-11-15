import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Users,
  Utensils,
  Wrench,
} from 'lucide-react';

import { EstadoListaEspera, EstadoMesa, EstadoReserva } from '../types';

export function TableStatusBadge({ status }: { status: EstadoMesa }) {
  const styles: Record<EstadoMesa, { classes: string; label: string; Icon: typeof CheckCircle2 }> = {
    LIBRE: {
      classes: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      label: 'Libre',
      Icon: CheckCircle2,
    },
    RESERVADA: {
      classes: 'bg-sky-100 text-sky-900 border-sky-300',
      label: 'Reservada',
      Icon: CalendarCheck,
    },
    OCUPADA: {
      classes: 'bg-amber-100 text-amber-950 border-amber-400',
      label: 'Ocupada',
      Icon: Utensils,
    },
    MANTENIMIENTO: {
      classes: 'bg-slate-200 text-slate-800 border-slate-300',
      label: 'Bloqueada',
      Icon: Wrench,
    },
  };

  const { classes, label, Icon } = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function ReservationStatusBadge({ status }: { status: EstadoReserva }) {
  const styles: Record<
    EstadoReserva,
    { classes: string; label: string; Icon: typeof CheckCircle2 }
  > = {
    PENDIENTE: {
      classes: 'bg-stone-100 text-stone-800 border-stone-300',
      label: 'Pendiente',
      Icon: Clock,
    },
    CONFIRMADA: {
      classes: 'bg-sky-100 text-sky-900 border-sky-300',
      label: 'Confirmada',
      Icon: CalendarCheck,
    },
    EN_CURSO: {
      classes: 'bg-amber-100 text-amber-950 border-amber-400',
      label: 'Sentado (En Curso)',
      Icon: Utensils,
    },
    COMPLETADA: {
      classes: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      label: 'Finalizada',
      Icon: CheckCircle2,
    },
    CANCELADA: {
      classes: 'bg-stone-200 text-stone-700 border-stone-300',
      label: 'Cancelada',
      Icon: Ban,
    },
    NO_SHOW: {
      classes: 'bg-rose-100 text-rose-900 border-rose-300',
      label: 'No-Show',
      Icon: AlertTriangle,
    },
  };

  const { classes, label, Icon } = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function WaitlistStatusBadge({ status }: { status: EstadoListaEspera }) {
  const styles: Record<
    EstadoListaEspera,
    { classes: string; label: string; Icon: typeof Users }
  > = {
    EN_ESPERA: {
      classes: 'bg-amber-100 text-amber-950 border-amber-300',
      label: 'En Espera',
      Icon: Clock,
    },
    NOTIFICADO: {
      classes: 'bg-sky-100 text-sky-900 border-sky-300',
      label: 'Notificado (Mesa libre)',
      Icon: CalendarCheck,
    },
    CONVERTIDO: {
      classes: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      label: 'Convertido',
      Icon: CheckCircle2,
    },
    EXPIRADO: {
      classes: 'bg-stone-200 text-stone-700 border-stone-300',
      label: 'Expirado',
      Icon: Ban,
    },
  };

  const { classes, label, Icon } = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

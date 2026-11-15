import {
  ApiErrorPayload,
  AvailabilityResponse,
  CreateReservationPayload,
  CreateWaitlistPayload,
  EstadoReserva,
  Reservation,
  Sector,
  TablesResponse,
  Turno,
  WaitlistEntry,
} from '../types';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'
).replace(/\/+$/, '');

export class RestoFlowApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'RestoFlowApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  const data = (await response.json().catch(() => null)) as
    | (T & Partial<ApiErrorPayload>)
    | null;

  if (!response.ok) {
    throw new RestoFlowApiError(response.status, {
      error: data?.error ?? 'Error',
      code: data?.code ?? 'REQUEST_FAILED',
      message: data?.message ?? `Error HTTP ${response.status} al comunicarse con RestoFlow.`,
      details: data?.details,
    });
  }

  if (!data) {
    throw new RestoFlowApiError(500, {
      error: 'Invalid Response',
      code: 'EMPTY_RESPONSE',
      message: 'El servidor devolvió una respuesta vacía.',
    });
  }

  return data;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export function getDefaultTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const restoFlowApi = {
  async getSectors(): Promise<Sector[]> {
    const res = await requestJson<{ sectors: Sector[] }>('/sectors');
    return res.sectors;
  },

  async getShifts(): Promise<Turno[]> {
    const res = await requestJson<{ shifts: Turno[] }>('/shifts');
    return res.shifts;
  },

  async checkAvailability(params: {
    fecha: string;
    turnoId: number;
    cantidadPersonas: number;
  }): Promise<AvailabilityResponse> {
    const qs = buildQuery(params);
    return requestJson<AvailabilityResponse>(`/availability${qs}`);
  },

  async getTables(params: {
    fecha: string;
    turnoId: number;
    sectorId?: number;
  }): Promise<TablesResponse> {
    const qs = buildQuery(params);
    return requestJson<TablesResponse>(`/tables${qs}`);
  },

  async listReservations(params: {
    fecha: string;
    turnoId?: number;
    sectorId?: number;
    estado?: EstadoReserva;
  }): Promise<Reservation[]> {
    const qs = buildQuery(params);
    const res = await requestJson<{ reservations: Reservation[] }>(`/reservations${qs}`);
    return res.reservations;
  },

  async lookupReservation(codigo: string, email: string): Promise<Reservation> {
    const qs = buildQuery({ codigo: codigo.trim().toUpperCase(), email: email.trim() });
    const res = await requestJson<{ reservation: Reservation }>(`/reservations/lookup${qs}`);
    return res.reservation;
  },

  async createReservation(payload: CreateReservationPayload): Promise<Reservation> {
    const res = await requestJson<{ reservation: Reservation }>('/reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.reservation;
  },

  async cancelByCode(codigo: string, email: string): Promise<{
    reservation: Reservation;
    promotedWaitlist: WaitlistEntry | null;
  }> {
    return requestJson('/reservations/cancel-by-code', {
      method: 'POST',
      body: JSON.stringify({
        codigo: codigo.trim().toUpperCase(),
        email: email.trim(),
      }),
    });
  },

  async updateReservationStatus(
    id: number,
    estado: EstadoReserva,
  ): Promise<{
    message: string;
    reservation: Reservation;
    customerBlocked: boolean;
    promotedWaitlist: WaitlistEntry | null;
  }> {
    return requestJson(`/reservations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
  },

  async listWaitlist(params: {
    fecha: string;
    turnoId?: number;
  }): Promise<WaitlistEntry[]> {
    const qs = buildQuery(params);
    const res = await requestJson<{ waitlist: WaitlistEntry[] }>(`/waitlist${qs}`);
    return res.waitlist;
  },

  async joinWaitlist(payload: CreateWaitlistPayload): Promise<WaitlistEntry> {
    const res = await requestJson<{ entry: WaitlistEntry }>('/waitlist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.entry;
  },

  async convertWaitlist(
    id: number,
    options?: { sectorId?: number; mesaId?: number; notas?: string },
  ): Promise<{ entry: WaitlistEntry; reservation: Reservation }> {
    return requestJson(`/waitlist/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
  },
};

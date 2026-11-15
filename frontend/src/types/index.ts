export type EstadoMesa = 'LIBRE' | 'RESERVADA' | 'OCUPADA' | 'MANTENIMIENTO';

export type EstadoReserva =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'NO_SHOW';

export type EstadoListaEspera = 'EN_ESPERA' | 'NOTIFICADO' | 'CONVERTIDO' | 'EXPIRADO';

export interface Sector {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  tablesCount: number;
}

export interface Turno {
  id: number;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  diasActivos: string;
}

export interface SectorAvailabilityItem {
  sectorId: number;
  nombre: string;
  descripcion: string;
  availableTablesCount: number;
  suggestedTable: {
    id: number;
    numero: string;
    capacidadMin: number;
    capacidadMax: number;
  } | null;
}

export interface AvailabilityResponse {
  fecha: string;
  turnoId: number;
  turnoNombre: string;
  cantidadPersonas: number;
  hasAnyAvailability: boolean;
  sectors: SectorAvailabilityItem[];
}

export interface Reservation {
  id: number;
  codigo: string;
  fecha: string;
  estado: EstadoReserva;
  cantidadPersonas: number;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  turno: {
    id: number;
    nombre: string;
    horaInicio: string;
    horaFin: string;
  };
  mesa: {
    id: number;
    numero: string;
    capacidadMin: number;
    capacidadMax: number;
    sectorId: number;
    sectorNombre: string;
  };
  cliente: {
    id: number;
    nombre: string;
    email: string;
    telefono: string;
    contadorNoShows: number;
    bloqueadoHasta: string | null;
  };
}

export interface TableStatusView {
  id: number;
  numero: string;
  capacidadMin: number;
  capacidadMax: number;
  sectorId: number;
  sectorNombre: string;
  estadoBase: EstadoMesa;
  estadoOperativo: EstadoMesa;
  activeReservation: {
    id: number;
    codigo: string;
    estado: EstadoReserva;
    cantidadPersonas: number;
    notas: string | null;
    clienteNombre: string;
    clienteEmail: string;
    clienteTelefono: string;
  } | null;
}

export interface ShiftMetrics {
  totalTables: number;
  activeTables: number;
  freeTables: number;
  reservedTables: number;
  occupiedTables: number;
  maintenanceTables: number;
  totalCapacity: number;
  reservedCovers: number;
  freeCovers: number;
  occupancyPercentage: number;
}

export interface TablesResponse {
  fecha: string;
  turnoId: number;
  metrics: ShiftMetrics;
  tables: TableStatusView[];
}

export interface WaitlistEntry {
  id: number;
  fecha: string;
  turnoId: number;
  turnoNombre: string;
  horaInicio: string;
  horaFin: string;
  cantidadPersonas: number;
  prioridad: number;
  estado: EstadoListaEspera;
  createdAt: string;
  cliente: {
    id: number;
    nombre: string;
    email: string;
    telefono: string;
  };
}

export interface CreateReservationPayload {
  fecha: string;
  turnoId: number;
  sectorId?: number;
  mesaId?: number;
  cantidadPersonas: number;
  nombre: string;
  email: string;
  telefono: string;
  notas?: string;
}

export interface CreateWaitlistPayload {
  fecha: string;
  turnoId: number;
  cantidadPersonas: number;
  nombre: string;
  email: string;
  telefono: string;
}

export interface ApiErrorPayload {
  error: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

import { useCallback, useEffect, useState } from 'react';

import { RestoFlowApiError, restoFlowApi } from '../services/api';
import {
  Reservation,
  Sector,
  TablesResponse,
  Turno,
  WaitlistEntry,
} from '../types';

export function useCatalog() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [shifts, setShifts] = useState<Turno[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function fetchCatalog() {
      try {
        const [sectorsData, shiftsData] = await Promise.all([
          restoFlowApi.getSectors(),
          restoFlowApi.getShifts(),
        ]);
        if (isCancelled) return;
        setSectors(sectorsData);
        setShifts(shiftsData);
        setError(null);
      } catch (err) {
        if (isCancelled) return;
        const message =
          err instanceof RestoFlowApiError
            ? err.message
            : 'No pudimos cargar los sectores y turnos del restaurante.';
        setError(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchCatalog();

    return () => {
      isCancelled = true;
    };
  }, [reloadKey]);

  return { sectors, shifts, isLoading, error, reload };
}

export function useHostOperations(params: {
  fecha: string;
  turnoId: number | null;
  sectorId?: number;
}) {
  const [tablesData, setTablesData] = useState<TablesResponse | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!params.turnoId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setRefreshTick((prev) => prev + 1);
  }, [params.turnoId]);

  useEffect(() => {
    if (!params.turnoId) {
      return;
    }

    let isCancelled = false;
    const targetTurnoId = params.turnoId;

    async function fetchOperations() {
      try {
        const [tablesRes, reservationsRes, waitlistRes] = await Promise.all([
          restoFlowApi.getTables({
            fecha: params.fecha,
            turnoId: targetTurnoId,
            sectorId: params.sectorId,
          }),
          restoFlowApi.listReservations({
            fecha: params.fecha,
            turnoId: targetTurnoId,
            sectorId: params.sectorId,
          }),
          restoFlowApi.listWaitlist({
            fecha: params.fecha,
            turnoId: targetTurnoId,
          }),
        ]);
        if (isCancelled) return;
        setTablesData(tablesRes);
        setReservations(reservationsRes);
        setWaitlist(waitlistRes);
        setError(null);
      } catch (err) {
        if (isCancelled) return;
        const message =
          err instanceof RestoFlowApiError
            ? err.message
            : 'No pudimos actualizar los datos operativos del turno.';
        setError(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchOperations();

    return () => {
      isCancelled = true;
    };
  }, [params.fecha, params.turnoId, params.sectorId, refreshTick]);

  return {
    tablesData,
    reservations,
    waitlist,
    isLoading,
    error,
    refresh,
  };
}

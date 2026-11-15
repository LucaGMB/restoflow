import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarPlus,
  LayoutDashboard,
  SearchCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { Toaster } from 'sonner';

import { HostDashboard } from './components/HostDashboard';
import { ManageReservation } from './components/ManageReservation';
import { ReservationWizard } from './components/ReservationWizard';
import { useCatalog } from './hooks/useRestoFlow';
import { Reservation } from './types';

type ActiveTab = 'reserve' | 'manage' | 'host';

const TAB_TITLES: Record<ActiveTab, string> = {
  reserve: 'Reservar Mesa | RestoFlow',
  manage: 'Gestionar mi Reserva | RestoFlow',
  host: 'Host Dashboard | RestoFlow',
};

export default function App() {
  const { sectors, shifts, isLoading, error, reload } = useCatalog();
  const [activeTab, setActiveTab] = useState<ActiveTab>('reserve');
  const [recentReservation, setRecentReservation] = useState<Reservation | null>(null);
  const [initialLookup, setInitialLookup] = useState<{
    codigo: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    document.title = TAB_TITLES[activeTab];
  }, [activeTab]);

  const handleGoToManage = (reservation: Reservation) => {
    setRecentReservation(reservation);
    setInitialLookup({
      codigo: reservation.codigo,
      email: reservation.cliente.email,
    });
    setActiveTab('manage');
  };

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
      <Toaster position="top-right" richColors closeButton />

      <a
        href="#main-content"
        className="visually-hidden rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Ir al contenido principal
      </a>

      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-700 text-white shadow-xs">
              <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-lg font-extrabold tracking-tight text-stone-900">
                RestoFlow
              </span>
              <span className="block text-xs font-medium text-stone-600">
                Gestión Inteligente de Reservas y Mesas
              </span>
            </div>
          </div>

          <nav aria-label="Navegación principal" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-current={activeTab === 'reserve' ? 'page' : undefined}
              onClick={() => setActiveTab('reserve')}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'reserve'
                  ? 'bg-orange-700 text-white shadow-xs'
                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
              }`}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              <span>Reservar Mesa</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'manage' ? 'page' : undefined}
              onClick={() => setActiveTab('manage')}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'manage'
                  ? 'bg-orange-700 text-white shadow-xs'
                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
              }`}
            >
              <SearchCheck className="h-4 w-4" aria-hidden="true" />
              <span>Gestionar mi Reserva</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'host' ? 'page' : undefined}
              onClick={() => setActiveTab('host')}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'host'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              <span>Host Dashboard</span>
            </button>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 focus:outline-none">
        {isLoading ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs">
            <progress className="w-48 accent-orange-700" aria-label="Cargando RestoFlow" />
            <p className="mt-3 text-sm font-medium text-stone-600">
              Conectando con el servidor de reservas...
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mx-auto max-w-xl rounded-2xl border border-rose-300 bg-rose-50 p-6 text-rose-950"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
              <div>
                <h1 className="font-bold">No pudimos cargar el catálogo del restaurante</h1>
                <p className="mt-1 text-sm">{error}</p>
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="mt-4 rounded-xl bg-rose-800 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-900"
                >
                  Reintentar conexión
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'reserve' && (
              <ReservationWizard
                shifts={shifts}
                onReservationCreated={(res) => setRecentReservation(res)}
                onGoToManage={handleGoToManage}
              />
            )}

            {activeTab === 'manage' && (
              <ManageReservation
                recentReservation={recentReservation}
                initialLookup={initialLookup}
              />
            )}

            {activeTab === 'host' && <HostDashboard sectors={sectors} shifts={shifts} />}
          </>
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white py-5 text-center text-xs text-stone-600">
        RestoFlow · Sistema Integral de Gestión Gastronómica
      </footer>
    </div>
  );
}

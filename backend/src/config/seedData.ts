import {
  Cliente,
  EstadoListaEspera,
  EstadoMesa,
  EstadoReserva,
  Mesa,
  PrismaClient,
} from '@prisma/client';

function normalizeUtcDate(offsetDays = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  );
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface SeedSummary {
  skipped: boolean;
  sectores: number;
  mesas: number;
  turnos: number;
  clientes: number;
  reservas: number;
  listaEspera: number;
}

/**
 * Populates initial catalog, customers, reservations, and waitlist entries.
 * When `reset` is false, skips execution if sectors already exist.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  options: { reset?: boolean } = {},
): Promise<SeedSummary> {
  if (!options.reset) {
    const existingSectors = await prisma.sector.count();
    if (existingSectors > 0) {
      return {
        skipped: true,
        sectores: existingSectors,
        mesas: 0,
        turnos: 0,
        clientes: 0,
        reservas: 0,
        listaEspera: 0,
      };
    }
  }

  const today = normalizeUtcDate(0);
  const tomorrow = normalizeUtcDate(1);
  const yesterday = normalizeUtcDate(-1);
  const fiveDaysAgo = normalizeUtcDate(-5);
  const tenDaysAgo = normalizeUtcDate(-10);
  const now = new Date();

  if (options.reset) {
    await prisma.$transaction([
      prisma.listaEspera.deleteMany(),
      prisma.reserva.deleteMany(),
      prisma.mesa.deleteMany(),
      prisma.cliente.deleteMany(),
      prisma.turno.deleteMany(),
      prisma.sector.deleteMany(),
    ]);
  }

  const salonPrincipal = await prisma.sector.create({
    data: {
      nombre: 'Salón Principal',
      descripcion: 'Ambiente central con iluminación cálida y acceso directo a cocina abierta.',
      activo: true,
    },
  });

  const terraza = await prisma.sector.create({
    data: {
      nombre: 'Terraza Calefaccionada',
      descripcion: 'Patio semicubierto con estufas exteriores y vegetación natural.',
      activo: true,
    },
  });

  const barraVip = await prisma.sector.create({
    data: {
      nombre: 'Barra / VIP',
      descripcion: 'Sector íntimo junto a la barra de autor y cava de vinos.',
      activo: true,
    },
  });

  const tablesData = [
    { numero: 'S-01', capacidadMin: 1, capacidadMax: 2, sectorId: salonPrincipal.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'S-02', capacidadMin: 2, capacidadMax: 2, sectorId: salonPrincipal.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'S-03', capacidadMin: 2, capacidadMax: 4, sectorId: salonPrincipal.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'S-04', capacidadMin: 4, capacidadMax: 6, sectorId: salonPrincipal.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'S-05', capacidadMin: 6, capacidadMax: 8, sectorId: salonPrincipal.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'T-01', capacidadMin: 2, capacidadMax: 2, sectorId: terraza.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'T-02', capacidadMin: 2, capacidadMax: 4, sectorId: terraza.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'T-03', capacidadMin: 2, capacidadMax: 4, sectorId: terraza.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'T-04', capacidadMin: 4, capacidadMax: 6, sectorId: terraza.id, estadoActual: EstadoMesa.MANTENIMIENTO },
    { numero: 'V-01', capacidadMin: 1, capacidadMax: 2, sectorId: barraVip.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'V-02', capacidadMin: 2, capacidadMax: 4, sectorId: barraVip.id, estadoActual: EstadoMesa.LIBRE },
    { numero: 'V-03', capacidadMin: 4, capacidadMax: 6, sectorId: barraVip.id, estadoActual: EstadoMesa.LIBRE },
  ];

  const mesas: Mesa[] = [];
  for (const table of tablesData) {
    mesas.push(await prisma.mesa.create({ data: table }));
  }
  const mesaByNumero = new Map(mesas.map((m) => [m.numero, m]));

  const almuerzo = await prisma.turno.create({
    data: {
      nombre: 'Almuerzo',
      horaInicio: '12:30',
      horaFin: '14:30',
      diasActivos: 'LUN,MAR,MIE,JUE,VIE,SAB,DOM',
    },
  });

  const cena1 = await prisma.turno.create({
    data: {
      nombre: 'Cena 1',
      horaInicio: '20:00',
      horaFin: '22:00',
      diasActivos: 'LUN,MAR,MIE,JUE,VIE,SAB,DOM',
    },
  });

  const cena2 = await prisma.turno.create({
    data: {
      nombre: 'Cena 2',
      horaInicio: '22:30',
      horaFin: '00:30',
      diasActivos: 'JUE,VIE,SAB,DOM',
    },
  });

  const customersInput = [
    { nombre: 'Camila Soto', email: 'camila.soto@example.com', telefono: '+54 9 11 5550-0101', contadorNoShows: 0 },
    { nombre: 'Mateo Navarro', email: 'mateo.navarro@example.com', telefono: '+54 9 11 5550-0102', contadorNoShows: 0 },
    { nombre: 'Valentina Ríos', email: 'valentina.rios@example.com', telefono: '+54 9 11 5550-0103', contadorNoShows: 0 },
    { nombre: 'Joaquín Herrera', email: 'joaquin.herrera@example.com', telefono: '+54 9 11 5550-0104', contadorNoShows: 0 },
    { nombre: 'Sofía Mendoza', email: 'sofia.mendoza@example.com', telefono: '+54 9 11 5550-0105', contadorNoShows: 0 },
    { nombre: 'Tomás Ibáñez', email: 'tomas.ibanez@example.com', telefono: '+54 9 11 5550-0106', contadorNoShows: 0 },
    { nombre: 'Julieta Pereyra', email: 'julieta.pereyra@example.com', telefono: '+54 9 11 5550-0107', contadorNoShows: 0 },
    { nombre: 'Bruno Castellanos', email: 'bruno.castellanos@example.com', telefono: '+54 9 11 5550-0108', contadorNoShows: 0 },
    {
      nombre: 'Paula Ferreyra',
      email: 'paula.ferreyra@example.com',
      telefono: '+54 9 11 5550-0109',
      contadorNoShows: 1,
      ultimoNoShowAt: addDays(now, -4),
    },
    {
      nombre: 'Diego Salgado',
      email: 'diego.salgado@example.com',
      telefono: '+54 9 11 5550-0110',
      contadorNoShows: 2,
      ultimoNoShowAt: addDays(now, -2),
      bloqueadoHasta: addDays(now, 28),
    },
  ];

  const clientes: Cliente[] = [];
  for (const customer of customersInput) {
    clientes.push(await prisma.cliente.create({ data: customer }));
  }
  const clienteByEmail = new Map(clientes.map((c) => [c.email, c]));

  const reservationsInput = [
    {
      codigo: 'RF-4821',
      fecha: today,
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('S-01')!.id,
      clienteId: clienteByEmail.get('camila.soto@example.com')!.id,
      cantidadPersonas: 2,
      notas: 'Aniversario, preferencia mesa tranquila',
      estado: EstadoReserva.EN_CURSO,
    },
    {
      codigo: 'RF-7392',
      fecha: today,
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('S-03')!.id,
      clienteId: clienteByEmail.get('mateo.navarro@example.com')!.id,
      cantidadPersonas: 4,
      notas: 'Un comensal celíaco',
      estado: EstadoReserva.CONFIRMADA,
    },
    {
      codigo: 'RF-5184',
      fecha: today,
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('T-02')!.id,
      clienteId: clienteByEmail.get('valentina.rios@example.com')!.id,
      cantidadPersonas: 3,
      notas: 'Cerca de calefactor exterior',
      estado: EstadoReserva.CONFIRMADA,
    },
    {
      codigo: 'RF-6295',
      fecha: today,
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('V-01')!.id,
      clienteId: clienteByEmail.get('joaquin.herrera@example.com')!.id,
      cantidadPersonas: 2,
      notas: 'Degustación de barra',
      estado: EstadoReserva.EN_CURSO,
    },
    {
      codigo: 'RF-3479',
      fecha: today,
      turnoId: almuerzo.id,
      mesaId: mesaByNumero.get('S-04')!.id,
      clienteId: clienteByEmail.get('sofia.mendoza@example.com')!.id,
      cantidadPersonas: 5,
      notas: 'Almuerzo ejecutivo',
      estado: EstadoReserva.CONFIRMADA,
    },
    {
      codigo: 'RF-8943',
      fecha: tomorrow,
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('V-02')!.id,
      clienteId: clienteByEmail.get('tomas.ibanez@example.com')!.id,
      cantidadPersonas: 4,
      notas: null,
      estado: EstadoReserva.CONFIRMADA,
    },
    {
      codigo: 'RF-2368',
      fecha: yesterday,
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('S-02')!.id,
      clienteId: clienteByEmail.get('julieta.pereyra@example.com')!.id,
      cantidadPersonas: 2,
      notas: 'Mesa estándar',
      estado: EstadoReserva.COMPLETADA,
    },
    {
      codigo: 'RF-2947',
      fecha: fiveDaysAgo,
      turnoId: cena2.id,
      mesaId: mesaByNumero.get('T-01')!.id,
      clienteId: clienteByEmail.get('paula.ferreyra@example.com')!.id,
      cantidadPersonas: 2,
      notas: null,
      estado: EstadoReserva.NO_SHOW,
    },
    {
      codigo: 'RF-3856',
      fecha: tenDaysAgo,
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('S-02')!.id,
      clienteId: clienteByEmail.get('diego.salgado@example.com')!.id,
      cantidadPersonas: 2,
      notas: null,
      estado: EstadoReserva.NO_SHOW,
    },
    {
      codigo: 'RF-4169',
      fecha: addDays(today, -2),
      turnoId: cena1.id,
      mesaId: mesaByNumero.get('V-01')!.id,
      clienteId: clienteByEmail.get('diego.salgado@example.com')!.id,
      cantidadPersonas: 2,
      notas: null,
      estado: EstadoReserva.NO_SHOW,
    },
  ];

  for (const reservation of reservationsInput) {
    await prisma.reserva.create({ data: reservation });
  }

  await prisma.listaEspera.createMany({
    data: [
      {
        fecha: today,
        turnoId: cena1.id,
        clienteId: clienteByEmail.get('julieta.pereyra@example.com')!.id,
        cantidadPersonas: 2,
        prioridad: 1,
        estado: EstadoListaEspera.EN_ESPERA,
      },
      {
        fecha: today,
        turnoId: cena1.id,
        clienteId: clienteByEmail.get('bruno.castellanos@example.com')!.id,
        cantidadPersonas: 4,
        prioridad: 2,
        estado: EstadoListaEspera.EN_ESPERA,
      },
    ],
  });

  return {
    skipped: false,
    sectores: 3,
    mesas: mesas.length,
    turnos: 3,
    clientes: clientes.length,
    reservas: reservationsInput.length,
    listaEspera: 2,
  };
}

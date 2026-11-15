import { EstadoListaEspera, EstadoMesa, EstadoReserva } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { prisma } from '../src/config/db.js';
import {
  formatDateOnlyUtc,
  generateUniqueReservationCode,
  parseDateOnlyUtc,
} from '../src/services/codeGenerator.js';

const app = createApp();
const TEST_DATE = '2026-12-20';

async function resetAndSeedTestFixture() {
  await prisma.$transaction([
    prisma.listaEspera.deleteMany(),
    prisma.reserva.deleteMany(),
    prisma.mesa.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.turno.deleteMany(),
    prisma.sector.deleteMany(),
  ]);

  const salon = await prisma.sector.create({
    data: {
      nombre: 'Salón Principal',
      descripcion: 'Salón de pruebas',
      activo: true,
    },
  });

  const terraza = await prisma.sector.create({
    data: {
      nombre: 'Terraza Calefaccionada',
      descripcion: 'Terraza de pruebas',
      activo: true,
    },
  });

  const turnoCena = await prisma.turno.create({
    data: {
      nombre: 'Cena 1',
      horaInicio: '20:00',
      horaFin: '22:00',
      diasActivos: 'LUN,MAR,MIE,JUE,VIE,SAB,DOM',
    },
  });

  const mesaChica = await prisma.mesa.create({
    data: {
      numero: 'S-01',
      capacidadMin: 1,
      capacidadMax: 2,
      sectorId: salon.id,
      estadoActual: EstadoMesa.LIBRE,
    },
  });

  const mesaMediana = await prisma.mesa.create({
    data: {
      numero: 'S-02',
      capacidadMin: 2,
      capacidadMax: 4,
      sectorId: salon.id,
      estadoActual: EstadoMesa.LIBRE,
    },
  });

  const mesaGrande = await prisma.mesa.create({
    data: {
      numero: 'S-03',
      capacidadMin: 4,
      capacidadMax: 6,
      sectorId: salon.id,
      estadoActual: EstadoMesa.LIBRE,
    },
  });

  const mesaTerraza = await prisma.mesa.create({
    data: {
      numero: 'T-01',
      capacidadMin: 2,
      capacidadMax: 4,
      sectorId: terraza.id,
      estadoActual: EstadoMesa.LIBRE,
    },
  });

  const mesaMantenimiento = await prisma.mesa.create({
    data: {
      numero: 'T-02',
      capacidadMin: 2,
      capacidadMax: 4,
      sectorId: terraza.id,
      estadoActual: EstadoMesa.MANTENIMIENTO,
    },
  });

  return {
    salon,
    terraza,
    turnoCena,
    mesaChica,
    mesaMediana,
    mesaGrande,
    mesaTerraza,
    mesaMantenimiento,
  };
}

describe('RestoFlow API & Reglas de Negocio', () => {
  beforeEach(async () => {
    await resetAndSeedTestFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('genera códigos RF-XXXX legibles sin caracteres ambiguos (O, 0, I, 1)', async () => {
    for (let i = 0; i < 20; i += 1) {
      const code = await generateUniqueReservationCode(prisma);
      expect(code).toMatch(/^RF-[A-HJ-NP-Z2-9]{4}$/);
      expect(code).not.toMatch(/[O0I1]/);
    }

    const parsed = parseDateOnlyUtc(TEST_DATE);
    expect(formatDateOnlyUtc(parsed)).toBe(TEST_DATE);
  });

  it('Caso 1: crea reserva asignando la mesa óptima de menor capacidad suficiente y código válido', async () => {
    const salon = await prisma.sector.findUniqueOrThrow({ where: { nombre: 'Salón Principal' } });
    const turno = await prisma.turno.findUniqueOrThrow({ where: { nombre: 'Cena 1' } });

    const response = await request(app).post('/api/reservations').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      sectorId: salon.id,
      cantidadPersonas: 2,
      nombre: 'Elena Martínez',
      email: 'elena.martinez@example.com',
      telefono: '+54 9 11 5551-1001',
      notas: 'Ventana por favor',
    });

    expect(response.status).toBe(201);
    expect(response.body.reservation.codigo).toMatch(/^RF-[A-HJ-NP-Z2-9]{4}$/);
    expect(response.body.reservation.estado).toBe(EstadoReserva.CONFIRMADA);
    // Para 2 personas debe elegir S-01 (capacidadMax=2) antes que S-02 (4) o S-03 (6)
    expect(response.body.reservation.mesa.numero).toBe('S-01');
    expect(response.body.reservation.mesa.capacidadMax).toBe(2);

    const tablesRes = await request(app)
      .get('/api/tables')
      .query({ fecha: TEST_DATE, turnoId: turno.id });
    expect(tablesRes.status).toBe(200);
    expect(tablesRes.body.metrics).toMatchObject({
      totalTables: 5,
      activeTables: 4,
      reservedTables: 1,
      occupiedTables: 0,
      maintenanceTables: 1,
      reservedCovers: 2,
      occupancyPercentage: 25,
    });
  });

  it('Caso 2: rechaza con 409 cuando no hay disponibilidad y registra en Lista de Espera FIFO', async () => {
    const terraza = await prisma.sector.findUniqueOrThrow({
      where: { nombre: 'Terraza Calefaccionada' },
    });
    const turno = await prisma.turno.findUniqueOrThrow({ where: { nombre: 'Cena 1' } });

    // Terraza solo tiene T-01 activa (T-02 está en MANTENIMIENTO)
    const first = await request(app).post('/api/reservations').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      sectorId: terraza.id,
      cantidadPersonas: 3,
      nombre: 'Lucas Gómez',
      email: 'lucas.gomez@example.com',
      telefono: '+54 9 11 5551-2001',
    });
    expect(first.status).toBe(201);
    expect(first.body.reservation.mesa.numero).toBe('T-01');

    // Segundo intento en Terraza para 3 personas debe fallar con 409 NO_AVAILABILITY
    const second = await request(app).post('/api/reservations').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      sectorId: terraza.id,
      cantidadPersonas: 3,
      nombre: 'Clara Duarte',
      email: 'clara.duarte@example.com',
      telefono: '+54 9 11 5551-2002',
    });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('NO_AVAILABILITY');
    expect(second.body.details.canJoinWaitlist).toBe(true);

    // Registro en Lista de Espera FIFO
    const wait1 = await request(app).post('/api/waitlist').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      cantidadPersonas: 3,
      nombre: 'Clara Duarte',
      email: 'clara.duarte@example.com',
      telefono: '+54 9 11 5551-2002',
    });
    expect(wait1.status).toBe(201);
    expect(wait1.body.entry.prioridad).toBe(1);
    expect(wait1.body.entry.estado).toBe(EstadoListaEspera.EN_ESPERA);

    const wait2 = await request(app).post('/api/waitlist').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      cantidadPersonas: 4,
      nombre: 'Andrés Silva',
      email: 'andres.silva@example.com',
      telefono: '+54 9 11 5551-2003',
    });
    expect(wait2.status).toBe(201);
    expect(wait2.body.entry.prioridad).toBe(2);

    // Duplicado activo en lista de espera debe retornar 409
    const duplicateWait = await request(app).post('/api/waitlist').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      cantidadPersonas: 3,
      nombre: 'Clara Duarte',
      email: 'clara.duarte@example.com',
      telefono: '+54 9 11 5551-2002',
    });
    expect(duplicateWait.status).toBe(409);
    expect(duplicateWait.body.code).toBe('WAITLIST_ALREADY_REGISTERED');
  });

  it('Caso 3: cancelar reserva promueve automáticamente al primer cliente compatible en Lista de Espera y permite convertirlo', async () => {
    const terraza = await prisma.sector.findUniqueOrThrow({
      where: { nombre: 'Terraza Calefaccionada' },
    });
    const turno = await prisma.turno.findUniqueOrThrow({ where: { nombre: 'Cena 1' } });

    const booking = await request(app).post('/api/reservations').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      sectorId: terraza.id,
      cantidadPersonas: 2,
      nombre: 'Valeria Luna',
      email: 'valeria.luna@example.com',
      telefono: '+54 9 11 5551-3001',
    });
    expect(booking.status).toBe(201);
    const codigo = booking.body.reservation.codigo;

    // Cliente 1 en lista de espera pide 6 personas (no cabe en T-01 de capMax=4)
    const waitIncompatible = await request(app).post('/api/waitlist').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      cantidadPersonas: 6,
      nombre: 'Grupo Grande',
      email: 'grupo.grande@example.com',
      telefono: '+54 9 11 5551-3002',
    });
    expect(waitIncompatible.status).toBe(201);

    // Cliente 2 en lista de espera pide 4 personas (sí cabe en T-01: 2..4)
    const waitCompatible = await request(app).post('/api/waitlist').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      cantidadPersonas: 4,
      nombre: 'Nadia Torres',
      email: 'nadia.torres@example.com',
      telefono: '+54 9 11 5551-3003',
    });
    expect(waitCompatible.status).toBe(201);

    // Cancelación pública por código + email
    const cancelRes = await request(app).post('/api/reservations/cancel-by-code').send({
      codigo,
      email: 'valeria.luna@example.com',
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.reservation.estado).toBe(EstadoReserva.CANCELADA);
    expect(cancelRes.body.promotedWaitlist).not.toBeNull();
    expect(cancelRes.body.promotedWaitlist.id).toBe(waitCompatible.body.entry.id);
    expect(cancelRes.body.promotedWaitlist.estado).toBe(EstadoListaEspera.NOTIFICADO);

    // Conversión de la lista de espera a reserva confirmada en T-01
    const convertRes = await request(app)
      .post(`/api/waitlist/${waitCompatible.body.entry.id}/convert`)
      .send({ sectorId: terraza.id });
    expect(convertRes.status).toBe(200);
    expect(convertRes.body.entry.estado).toBe(EstadoListaEspera.CONVERTIDO);
    expect(convertRes.body.reservation.estado).toBe(EstadoReserva.CONFIRMADA);
    expect(convertRes.body.reservation.mesa.numero).toBe('T-01');
  });

  it('Caso 4: bloquea automáticamente por 30 días al cliente tras acumular 2 No-Shows', async () => {
    const salon = await prisma.sector.findUniqueOrThrow({ where: { nombre: 'Salón Principal' } });
    const turno = await prisma.turno.findUniqueOrThrow({ where: { nombre: 'Cena 1' } });
    const customerPayload = {
      nombre: 'Gabriel Rojas',
      email: 'gabriel.rojas@example.com',
      telefono: '+54 9 11 5551-4001',
    };

    const res1 = await request(app).post('/api/reservations').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      sectorId: salon.id,
      cantidadPersonas: 2,
      ...customerPayload,
    });
    expect(res1.status).toBe(201);

    const noShow1 = await request(app)
      .patch(`/api/reservations/${res1.body.reservation.id}/status`)
      .send({ estado: EstadoReserva.NO_SHOW });
    expect(noShow1.status).toBe(200);
    expect(noShow1.body.customerBlocked).toBe(false);
    expect(noShow1.body.reservation.cliente.contadorNoShows).toBe(1);

    // Segunda reserva (aún permitido porque lleva solo 1 No-Show)
    const res2 = await request(app).post('/api/reservations').send({
      fecha: '2026-12-21',
      turnoId: turno.id,
      sectorId: salon.id,
      cantidadPersonas: 2,
      ...customerPayload,
    });
    expect(res2.status).toBe(201);

    const noShow2 = await request(app)
      .patch(`/api/reservations/${res2.body.reservation.id}/status`)
      .send({ estado: EstadoReserva.NO_SHOW });
    expect(noShow2.status).toBe(200);
    expect(noShow2.body.customerBlocked).toBe(true);
    expect(noShow2.body.reservation.cliente.contadorNoShows).toBe(2);
    expect(noShow2.body.reservation.cliente.bloqueadoHasta).not.toBeNull();

    // Tercer intento de reserva debe ser rechazado con 422 CUSTOMER_BLOCKED
    const res3 = await request(app).post('/api/reservations').send({
      fecha: '2026-12-22',
      turnoId: turno.id,
      sectorId: salon.id,
      cantidadPersonas: 2,
      ...customerPayload,
    });
    expect(res3.status).toBe(422);
    expect(res3.body.code).toBe('CUSTOMER_BLOCKED');

    // También bloquea ingreso a lista de espera
    const waitBlocked = await request(app).post('/api/waitlist').send({
      fecha: '2026-12-22',
      turnoId: turno.id,
      cantidadPersonas: 2,
      ...customerPayload,
    });
    expect(waitBlocked.status).toBe(422);
    expect(waitBlocked.body.code).toBe('CUSTOMER_BLOCKED');
  });

  it('Caso 5: previene race condition en reservas concurrentes sobre la última mesa disponible', async () => {
    const terraza = await prisma.sector.findUniqueOrThrow({
      where: { nombre: 'Terraza Calefaccionada' },
    });
    const turno = await prisma.turno.findUniqueOrThrow({ where: { nombre: 'Cena 1' } });

    const [attemptA, attemptB] = await Promise.all([
      request(app).post('/api/reservations').send({
        fecha: TEST_DATE,
        turnoId: turno.id,
        sectorId: terraza.id,
        cantidadPersonas: 2,
        nombre: 'Concurrente Uno',
        email: 'concurrente1@example.com',
        telefono: '+54 9 11 5551-5001',
      }),
      request(app).post('/api/reservations').send({
        fecha: TEST_DATE,
        turnoId: turno.id,
        sectorId: terraza.id,
        cantidadPersonas: 3,
        nombre: 'Concurrente Dos',
        email: 'concurrente2@example.com',
        telefono: '+54 9 11 5551-5002',
      }),
    ]);

    const statuses = [attemptA.status, attemptB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const activeCount = await prisma.reserva.count({
      where: {
        fecha: parseDateOnlyUtc(TEST_DATE),
        turnoId: turno.id,
        estado: EstadoReserva.CONFIRMADA,
      },
    });
    expect(activeCount).toBe(1);
  });

  it('valida lookup público, ciclo completo del Host, transiciones inválidas y errores Zod', async () => {
    const salon = await prisma.sector.findUniqueOrThrow({ where: { nombre: 'Salón Principal' } });
    const turno = await prisma.turno.findUniqueOrThrow({ where: { nombre: 'Cena 1' } });
    const mesaMantenimiento = await prisma.mesa.findUniqueOrThrow({ where: { numero: 'T-02' } });

    // Validación Zod 400
    const badRequest = await request(app).post('/api/reservations').send({
      fecha: '15-11-2026',
      turnoId: turno.id,
      cantidadPersonas: 0,
      nombre: 'A',
      email: 'correo-invalido',
      telefono: '123',
    });
    expect(badRequest.status).toBe(400);
    expect(badRequest.body.code).toBe('VALIDATION_ERROR');

    // Mesa en mantenimiento rechazada con 409
    const maintenanceAttempt = await request(app).post('/api/reservations').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      mesaId: mesaMantenimiento.id,
      cantidadPersonas: 2,
      nombre: 'Carlos Méndez',
      email: 'carlos.mendez@example.com',
      telefono: '+54 9 11 5551-6001',
    });
    expect(maintenanceAttempt.status).toBe(409);
    expect(maintenanceAttempt.body.code).toBe('TABLE_IN_MAINTENANCE');

    // Crear y buscar por código + email
    const created = await request(app).post('/api/reservations').send({
      fecha: TEST_DATE,
      turnoId: turno.id,
      sectorId: salon.id,
      cantidadPersonas: 2,
      nombre: 'Carlos Méndez',
      email: 'carlos.mendez@example.com',
      telefono: '+54 9 11 5551-6001',
    });
    expect(created.status).toBe(201);
    const { id, codigo } = created.body.reservation;

    const lookupOk = await request(app)
      .get('/api/reservations/lookup')
      .query({ codigo, email: 'CARLOS.MENDEZ@EXAMPLE.COM' });
    expect(lookupOk.status).toBe(200);
    expect(lookupOk.body.reservation.codigo).toBe(codigo);

    const lookupWrongEmail = await request(app)
      .get('/api/reservations/lookup')
      .query({ codigo, email: 'otro@example.com' });
    expect(lookupWrongEmail.status).toBe(404);

    // Flujo Host: CONFIRMADA -> EN_CURSO -> COMPLETADA
    const checkIn = await request(app)
      .patch(`/api/reservations/${id}/status`)
      .send({ estado: EstadoReserva.EN_CURSO });
    expect(checkIn.status).toBe(200);
    expect(checkIn.body.reservation.estado).toBe(EstadoReserva.EN_CURSO);

    const complete = await request(app)
      .patch(`/api/reservations/${id}/status`)
      .send({ estado: EstadoReserva.COMPLETADA });
    expect(complete.status).toBe(200);
    expect(complete.body.reservation.estado).toBe(EstadoReserva.COMPLETADA);

    // Transición inválida desde estado terminal COMPLETADA -> NO_SHOW
    const invalidTransition = await request(app)
      .patch(`/api/reservations/${id}/status`)
      .send({ estado: EstadoReserva.NO_SHOW });
    expect(invalidTransition.status).toBe(409);
    expect(invalidTransition.body.code).toBe('INVALID_STATE_TRANSITION');
  });
});

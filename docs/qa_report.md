# Plan y Reporte de QA — RestoFlow

## 1. Estrategia de Testing

La estrategia de aseguramiento de calidad de **RestoFlow** implementa una pirámide de pruebas de tres niveles para garantizar la integridad de las reglas del dominio gastronómico, la consistencia transaccional y la experiencia de usuario sin regresiones:

1. **Pruebas Unitarias (Lógica de Dominio)**:
   - Validación del generador de códigos legibles `RF-XXXX` (longitud, formato y exclusión de caracteres ambiguos `O`, `0`, `I`, `1`).
   - Normalización de fechas UTC (`parseDateOnlyUtc` y `formatDateOnlyUtc`) para prevenir desfases horarios entre cliente y servidor.
2. **Pruebas de Integración (API REST + Base de Datos Real)**:
   - Ejecución de peticiones HTTP reales contra la instancia Express (`createApp()`) utilizando **Vitest** y **Supertest** conectados a una base de datos SQLite aislada (`prisma/test.db`) reiniciada antes de cada caso (`beforeEach`).
   - Verificación integral de esquemas Zod (`400`), reglas de capacidad óptima (`RN-02`), lista de espera FIFO (`RN-04`), bloqueo automático por ausentismo (`RN-03`), máquina de estados y serialización de concurrencia (`RN-01`).
3. **Pruebas E2E en Navegador Real (UI, Red y Consola)**:
   - Interacción real sobre la SPA compilada/servida con Vite + React conectada al backend Express y SQLite poblado con `prisma/seed.ts`.
   - Verificación automatizada mediante **Chrome DevTools MCP** inspeccionando el árbol de accesibilidad, captura visual de pantalla completa, logs de consola (`0 errors`) y respuestas HTTP de red (`0 errors 500 / 404`).

---

## 2. Casos de Aceptación (Gherkin)

### Caso 1: Creación exitosa de reserva en mesa óptima

```gherkin
Feature: Asignación óptima de mesas en reservas online
  Scenario: Un grupo de 2 personas reserva en un sector con mesas de 2, 4 y 6 cubiertos
    Given que existen mesas libres S-01 (cap 1-2), S-02 (cap 2-4) y S-03 (cap 4-6) en "Salón Principal" para el turno "Cena 1"
    When el comensal envía una solicitud POST /api/reservations para 2 personas en "Salón Principal"
    Then el sistema responde HTTP 201 Created
    And genera un código único con formato RF-XXXX sin caracteres O, 0, I ni 1
    And asigna automáticamente la mesa S-01 (menor capacidad máxima suficiente = 2) en estado CONFIRMADA
    And las métricas de GET /api/tables reflejan 1 mesa reservada y 2 cubiertos reservados
```

### Caso 2: Intento de reserva en turno sin disponibilidad y registro en Lista de Espera

```gherkin
Feature: Gestión de demanda excedente mediante Lista de Espera FIFO
  Scenario: El sector solicitado ya tiene todas sus mesas compatibles ocupadas
    Given que la única mesa operativa en "Terraza Calefaccionada" (T-01, cap 2-4) ya tiene una reserva CONFIRMADA para "Cena 1"
    And la mesa T-02 se encuentra en estado MANTENIMIENTO
    When otro comensal intenta reservar para 3 personas en "Terraza Calefaccionada" en el mismo turno
    Then el sistema rechaza la solicitud con HTTP 409 Conflict y código "NO_AVAILABILITY"
    And devuelve details.canJoinWaitlist = true
    When el comensal se registra mediante POST /api/waitlist para esa fecha y turno
    Then el sistema responde HTTP 201 Created con estado "EN_ESPERA" y prioridad FIFO incremental (prioridad = 1)
```

### Caso 3: Cancelación de reserva y disparo de notificación a Lista de Espera

```gherkin
Feature: Promoción automática de Lista de Espera al liberar una mesa
  Scenario: Se cancela una reserva confirmada habiendo clientes compatibles en espera
    Given que la mesa T-01 (cap 2-4) está reservada con código RF-XXXX
    And en ListaEspera hay una entrada prioridad 1 para 6 personas (incompatible) y una entrada prioridad 2 para 4 personas (compatible)
    When el titular cancela la reserva mediante POST /api/reservations/cancel-by-code con su código y correo
    Then la reserva cambia a estado CANCELADA
    And el sistema salta el grupo incompatible de 6 personas y promueve automáticamente la entrada de 4 personas a estado NOTIFICADO
    When el Host ejecuta POST /api/waitlist/:id/convert
    Then la entrada pasa a estado CONVERTIDO y se crea una nueva reserva CONFIRMADA sobre la mesa T-01
```

### Caso 4: Bloqueo de cliente tras acumular 2 No-Shows

```gherkin
Feature: Política de protección contra ausentismo recurrente (No-Show)
  Scenario: Un cliente acumula 2 ausencias dentro de una ventana de 30 días
    Given que un cliente realizó una primera reserva y el Host la marcó como NO_SHOW (contadorNoShows = 1)
    When realiza una segunda reserva y el Host vuelve a marcarla como NO_SHOW
    Then el contador del cliente sube a 2 y bloqueadoHasta se fija automáticamente a +30 días en el futuro
    And la respuesta devuelve customerBlocked = true
    When el mismo cliente intenta crear una tercera reserva o sumarse a Lista de Espera con su email
    Then el sistema rechaza la operación con HTTP 422 Unprocessable Entity y código "CUSTOMER_BLOCKED"
```

### Caso 5: Detección y rechazo de reserva concurrente sobre la misma mesa (Race condition)

```gherkin
Feature: Prevención de Double Booking ante peticiones simultáneas
  Scenario: Dos comensales solicitan simultáneamente la última mesa disponible del sector
    Given que solo queda 1 mesa libre compatible (T-01) en "Terraza Calefaccionada" para la fecha y turno elegidos
    When dos clientes envían peticiones POST /api/reservations en paralelo (Promise.all) por esa última plaza
    Then la exclusión mutua y transacción atómica serializan ambas solicitudes
    And exactamente una solicitud responde HTTP 201 Created
    And la solicitud perdedora responde HTTP 409 Conflict con código "NO_AVAILABILITY"
    And en la base de datos persiste exactamente 1 reserva CONFIRMADA para ese slot
```

---

## 3. Matriz de Ejecución de Pruebas

| ID | Caso / Cobertura | Tipo | Comando / Herramienta | Resultado |
| :--- | :--- | :--- | :--- | :--- |
| **UT-01** | Generación de códigos `RF-XXXX` sin `O/0/I/1` y normalización UTC | Unitaria | `pnpm --filter restoflow-backend test` (Vitest) | **PASS** |
| **IT-01** | Caso 1: Reserva exitosa con algoritmo de mesa óptima + métricas | Integración (API + DB) | `pnpm --filter restoflow-backend test` (Supertest + SQLite) | **PASS** |
| **IT-02** | Caso 2: Rechazo `409 NO_AVAILABILITY` + alta FIFO en Lista de Espera + anti-duplicado | Integración (API + DB) | `pnpm --filter restoflow-backend test` (Supertest + SQLite) | **PASS** |
| **IT-03** | Caso 3: Cancelación por código + promoción selectiva `NOTIFICADO` + conversión | Integración (API + DB) | `pnpm --filter restoflow-backend test` (Supertest + SQLite) | **PASS** |
| **IT-04** | Caso 4: Acumulación de 2 `NO_SHOW`, bloqueo de 30 días y rechazo `422 CUSTOMER_BLOCKED` | Integración (API + DB) | `pnpm --filter restoflow-backend test` (Supertest + SQLite) | **PASS** |
| **IT-05** | Caso 5: Concurrencia `Promise.all` sobre última mesa (`[201, 409]`) | Integración (API + DB) | `pnpm --filter restoflow-backend test` (Supertest + SQLite) | **PASS** |
| **IT-06** | Lookup público, flujo `EN_CURSO -> COMPLETADA`, transición inválida `409` y Zod `400` | Integración (API + DB) | `pnpm --filter restoflow-backend test` (Supertest + SQLite) | **PASS** |
| **E2E-01** | Wizard 3 pasos en navegador: selección turno, sector `Salón Principal`, alta `RF-5V46` en Mesa `S-02` | E2E UI | Chrome DevTools MCP (`http://localhost:5173`) | **PASS** |
| **E2E-02** | Host Dashboard: visualización de mapa de mesas, KPIs y acción "Sentar Comensal" (`S-03` -> `OCUPADA`) | E2E UI | Chrome DevTools MCP (`http://localhost:5173`) | **PASS** |
| **E2E-03** | Gestionar mi Reserva: búsqueda `RF-5V46`, confirmación en `<dialog>` modal, cancelación y notificación automática a Lista de Espera | E2E UI | Chrome DevTools MCP (`http://localhost:5173`) | **PASS** |
| **E2E-04** | Auditoría de consola, red y layout visual post-ajustes | E2E UI / Visual | Chrome DevTools MCP (`list_console_messages`, `list_network_requests`, screenshots) | **PASS** |
| **QA-01** | Typechecking estricto, linting ESLint y builds de producción | Calidad / Build | `pnpm typecheck`, `pnpm lint`, `pnpm build` (backend y frontend) | **PASS** |

---

## 4. Hallazgos Detectados y Resueltos Durante QA

1. **Contención de escritura SQLite en `seed.ts`**: Al sembrar las tablas en paralelo con `Promise.all`, SQLite arrojó error `P1008` de timeout. Se refactorizó `backend/prisma/seed.ts` a inserciones secuenciales (`for...of`), resolviendo el timeout por completo.
2. **Cabecera fija en captura de página completa y ancho de tabla en Host Dashboard**: La inspección visual del Host Dashboard reveló superposición del `<header>` sticky en capturas `fullPage` y recorte lateral en la columna `Estado` de la tabla de reservas. Se ajustó `App.tsx` y el espaciado en `HostDashboard.tsx` (apilando `Mesa` y `Sector` en dos líneas), logrando una tabla completamente visible sin desborde en desktop.
3. **Recurso `favicon.ico` 404 en consola**: La auditoría de consola/red en Chrome DevTools detectó un `404` sobre `/favicon.ico`. Se incorporó un icono SVG embebido en `frontend/index.html`, obteniendo **0 errores de consola** y **0 errores de red** en la verificación final.

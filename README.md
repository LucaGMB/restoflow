# RestoFlow — Sistema Integral de Gestión de Reservas y Mesas

> [!NOTE]
> **Aplicación desplegada:** [https://restoflow.lucagmb.com.ar](https://restoflow.lucagmb.com.ar)
>
> **Aviso:** Este proyecto fue desarrollado exclusivamente como entrega para un curso obligatorio. A fines prácticos y como ejercicio de automatización, todo el contenido de este repositorio (código fuente, pruebas y textos explicativos) fue generado 100% mediante modelos de lenguaje (LLMs) y agentes de IA, limitando mi intervención únicamente a la orquestación de las herramientas. Por lo tanto, no refleja mi estilo personal de desarrollo ni representa un trabajo de autoría propia.

![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Prisma](https://img.shields.io/badge/Prisma-6.5-2D3748?logo=prisma&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)

**RestoFlow** es una plataforma full-stack diseñada para optimizar la operación diaria de restaurantes y bares gastronómicos. Elimina el *double booking*, asigna automáticamente la mesa de capacidad óptima, automatiza la promoción de la lista de espera al producirse cancelaciones y protege al restaurante ante ausentismos recurrentes (*no-shows*).

---

## Funcionalidades Principales

### Para Comensales (Vista Pública)
- **Wizard de Reserva en 3 Pasos**: Selección de fecha, comensales y turno (`Almuerzo`, `Cena 1`, `Cena 2`), verificación de disponibilidad en vivo por sector (`Salón Principal`, `Terraza Calefaccionada`, `Barra / VIP`) y confirmación inmediata con código único legible (`RF-XXXX`).
- **Lista de Espera Automática**: Si el turno o sector está completo, el cliente puede anotarse en la cola FIFO con un clic.
- **Autogestión de Reserva**: Consulta de estado y cancelación en línea ingresando código `RF-XXXX` y correo electrónico.

### Para Staff / Host (Dashboard Operativo)
- **KPIs en Tiempo Real**: Porcentaje de ocupación, mesas libres/reservadas/ocupadas/bloqueadas y balance de cubiertos reservados vs. disponibles.
- **Mapa Visual de Mesas por Sector**: Identificación inmediata por color y estado (`Libre`, `Reservada`, `Ocupada`, `Bloqueada`) con acciones rápidas (`Sentar Comensal`, `Liberar Mesa`, `Marcar No-Show`, `Cancelar`).
- **Lista de Espera Interactiva**: Cola ordenada por prioridad FIFO con notificaciones automáticas tras cancelaciones, ingreso rápido de *walk-ins* y conversión en reserva con un clic.

---

## Arquitectura y Stack Tecnológico

```text
restoflow/
├── backend/                  # API REST (Express 5 + TypeScript + Prisma + Zod)
│   ├── prisma/               # Esquema relacional (SQLite / PostgreSQL) y seed
│   ├── src/
│   │   ├── config/           # Entorno y singleton Prisma
│   │   ├── controllers/      # Adaptadores HTTP
│   │   ├── services/         # Reglas de negocio (RN-01 a RN-05)
│   │   ├── repositories/     # Capa de persistencia
│   │   ├── routes/           # Rutas REST bajo /api
│   │   ├── middlewares/      # Validación Zod y manejo de errores
│   │   └── types/            # DTOs y esquemas
│   └── tests/                # Suite automatizada Vitest + Supertest
├── frontend/                 # SPA (React 19 + Vite + Tailwind CSS v4)
│   └── src/
│       ├── components/       # ReservationWizard, ManageReservation, HostDashboard
│       ├── hooks/            # Custom hooks para catálogo y operaciones Host
│       ├── services/         # Cliente HTTP Fetch tipado
│       └── types/            # Tipos compartidos
└── docs/
    ├── spec.md               # Especificación funcional, Mermaid ER/State y contrato REST
    └── qa_report.md          # Estrategia QA, casos Gherkin y resultados de pruebas
```

---

## Guía de Inicio Local con `pnpm`

> **Requisito**: Utilizar exclusivamente **`pnpm`** como gestor de paquetes (`corepack enable` o instalación global de `pnpm`).

### 1. Preparar variables de entorno

Copia los archivos `.env.example` como punto de partida si deseas personalizar puertos o cadenas de conexión:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Variables por defecto:
- `backend/.env`: `PORT=3001`, `DATABASE_URL="file:./dev.db"`, `CORS_ORIGIN="http://localhost:5173"`
- `frontend/.env`: `VITE_API_URL="http://localhost:3001/api"`

### 2. Instalar dependencias

Desde la raíz `restoflow/`:

```bash
pnpm install
```

### 3. Sincronizar esquema y poblar la base de datos

```bash
pnpm --filter restoflow-backend db:generate
pnpm --filter restoflow-backend db:push
pnpm --filter restoflow-backend db:seed
```

*(Si prefieres trabajar con historial de migraciones en entorno local, ejecuta `pnpm --filter restoflow-backend db:migrate --name init` en lugar de `db:push`.)*

### 4. Ejecutar en modo desarrollo

En dos terminales (o usando filtros en paralelo):

```bash
# Terminal 1 — Backend API (http://localhost:3001/api)
pnpm dev:backend

# Terminal 2 — Frontend SPA (http://localhost:5173)
pnpm dev:frontend
```

### 5. Ejecutar pruebas, linting y build de producción

```bash
# Pruebas unitarias y de integración (Vitest + Supertest sobre test.db aislada)
pnpm test

# Verificación de tipos y ESLint en ambos paquetes
pnpm --filter restoflow-backend typecheck && pnpm --filter restoflow-backend lint
pnpm --filter restoflow-frontend typecheck && pnpm --filter restoflow-frontend lint

# Build de producción (TypeScript + Vite)
pnpm build
```

---

## Documentación Técnica

- **[Especificación Funcional y Técnica (`docs/spec.md`)](docs/spec.md)**: Diagramas `erDiagram` y `stateDiagram-v2`, matriz de reglas de negocio (`RN-01` a `RN-05`) y contrato completo de API REST.
- **[Plan y Reporte de QA (`docs/qa_report.md`)](docs/qa_report.md)**: Casos Gherkin (`Given/When/Then`), matriz de ejecución de pruebas y evidencias E2E.

---

## Guía de Despliegue en la Nube (Producción)

### 1. Base de Datos — Neon Serverless Postgres
1. Crea un proyecto gratuito en [Neon](https://neon.tech) y copia la cadena de conexión (`postgresql://USER:PASSWORD@HOST/restoflow?sslmode=require`).
2. En `backend/prisma/schema.prisma`, cambia `provider = "sqlite"` por `provider = "postgresql"`.
3. Ejecuta las migraciones hacia producción con:
   ```bash
   DATABASE_URL="postgresql://..." pnpm --filter restoflow-backend prisma migrate deploy
   ```

### 2. Backend API — Render / Railway
1. Crea un servicio Web apuntando al directorio `backend/` del repositorio.
2. **Build Command**: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm build`
3. **Start Command**: `pnpm start`
4. Configura las variables de entorno:
   - `DATABASE_URL`: URL de conexión de Neon Postgres.
   - `PORT`: puerto asignado por la plataforma (ej. `10000`).
   - `CORS_ORIGIN`: URL pública de tu frontend (ej. `https://restoflow.vercel.app`).

### 3. Frontend SPA — Vercel / Netlify
1. Conecta el repositorio seleccionando `frontend/` como directorio raíz.
2. **Build Command**: `pnpm build`
3. **Output Directory**: `dist`
4. Configura la variable de entorno:
   - `VITE_API_URL`: URL pública de la API desplegada (ej. `https://restoflow-api.onrender.com/api`).

### 4. Despliegue unificado con Docker Compose
También se incluyen `backend/Dockerfile`, `frontend/Dockerfile` y `docker-compose.yml` (Nginx sirviendo el SPA y haciendo proxy de `/api/` hacia el backend, con volumen persistente para SQLite):

```bash
docker compose up --build -d
```

Por defecto queda disponible en `http://localhost:8080`.

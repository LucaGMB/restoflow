import { createApp } from './app.js';
import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { seedDatabase } from './config/seedData.js';

async function bootstrap(): Promise<void> {
  if (env.nodeEnv !== 'test') {
    const summary = await seedDatabase(prisma, { reset: false });
    if (!summary.skipped) {
      console.log('Base de datos inicializada con datos demo:', summary);
    }
  }

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`RestoFlow API escuchando en http://localhost:${env.port}/api`);
  });

  async function shutdown(): Promise<void> {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(async (error) => {
  console.error('Error al iniciar RestoFlow API:', error);
  await prisma.$disconnect();
  process.exit(1);
});

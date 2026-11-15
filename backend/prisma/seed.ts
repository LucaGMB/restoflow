import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/config/seedData.js';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const summary = await seedDatabase(prisma, { reset: true });
  console.log('Seed de RestoFlow completado:', summary);
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

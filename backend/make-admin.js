import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error("Please provide an email address! Usage: node make-admin.js <your-email>");
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { email: email },
      data: { role: 'ADMIN' },
    });
    console.log(`Success! ${user.email} is now an ADMIN.`);
  } catch (error) {
    console.error("Error updating user. Make sure the email exists in the database.", error.meta?.cause || error);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();

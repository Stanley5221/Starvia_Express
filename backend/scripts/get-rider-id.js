const { PrismaClient } = require('@prisma/client');

async function main(){
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: process.env.RIDER_EMAIL || 'rider@starviadelivery.com' } });
    if (!user) { console.log('NO_USER'); return }
    const rider = await prisma.rider.findUnique({ where: { userId: user.id } });
    if (!rider) { console.log('NO_RIDER'); return }
    console.log(rider.id);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

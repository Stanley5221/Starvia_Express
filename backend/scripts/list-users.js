const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true, createdAt: true },
    orderBy: { role: 'asc' },
  });
  console.log('\nUsers in database:\n');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(10)} ${u.email}  (${u.name})`);
  }
  const riders = await prisma.rider.findMany({
    select: { fullName: true, isApproved: true, user: { select: { email: true } } },
  });
  if (riders.length) {
    console.log('\nRider profiles:\n');
    for (const r of riders) {
      console.log(`  ${r.fullName} — ${r.user.email} — approved: ${r.isApproved}`);
    }
  }
  console.log('\nDefault seed passwords (if you ran seed scripts):');
  console.log('  Admin:  from ADMIN_PASSWORD in backend/.env (run: node seed-admin.js)');
  console.log('  Rider:  rider@starviadelivery.com / password123 (run: node seed-rider.js)\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

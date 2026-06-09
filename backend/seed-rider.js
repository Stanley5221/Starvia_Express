const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.RIDER_EMAIL || 'rider@starviadelivery.com';
  const passwordText = process.env.RIDER_PASSWORD || 'password123';
  const password = await bcrypt.hash(passwordText, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: password,
      name: 'John Rider',
      phone: '+2348000000001',
      role: 'RIDER',
    },
  });

  await prisma.rider.upsert({
    where: { userId: user.id },
    update: { isApproved: true, isAvailable: true },
    create: {
      userId: user.id,
      fullName: 'John Rider',
      phone: '+2348000000001',
      motorPlate: 'RID-1234',
      motorMake: 'Honda',
      motorModel: 'CB125',
      motorColor: 'Black',
      licenceNumber: 'DL-12345',
      licenceExpiry: new Date('2027-12-31'),
      isApproved: true,
      isAvailable: true,
    },
  });

  console.log('✅ Rider account created successfully!');
  console.log(`Email: ${email}`);
  console.log('Password: [HIDDEN]');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

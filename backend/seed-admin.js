const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const passwordText = process.env.ADMIN_PASSWORD;

  if (!email || !passwordText) {
    console.error("❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env");
    process.exit(1);
  }

  const password = await bcrypt.hash(passwordText, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: password,
      name: 'Super Admin',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin account created successfully!');
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

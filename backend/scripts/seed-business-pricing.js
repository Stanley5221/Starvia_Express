/**
 * seed-business-pricing.js
 * Seeds the global business pricing default into BusinessPricingConfig.
 * businessId = null means this is the global rate applied to ALL business accounts.
 * Run: node scripts/seed-business-pricing.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding global business pricing config...');

  const existing = await prisma.businessPricingConfig.findFirst({
    where: { businessId: null },
  });

  if (existing) {
    console.log('✅ Global business pricing already exists:');
    console.log(`   GH₵${existing.pricePerKm}/km | Base: GH₵${existing.basePrice} | Min: GH₵${existing.minPrice}`);
    return;
  }

  const config = await prisma.businessPricingConfig.create({
    data: {
      businessId: null,        // null = global default for all businesses
      pricePerKm: 3.0,         // GH₵ 3.00/km (vs GH₵ 4.00/km for individual customers)
      basePrice: 5.0,          // GH₵ 5.00 flag-fall
      minPrice: 8.0,           // GH₵ 8.00 minimum charge
      discountPercent: 0,      // No additional discount (Release 2 will use this for tiers)
      label: 'Business Rate',
      isActive: true,
    },
  });

  console.log('✅ Global business pricing created:');
  console.log(`   ID: ${config.id}`);
  console.log(`   Rate: GH₵${config.pricePerKm}/km`);
  console.log(`   Base: GH₵${config.basePrice}`);
  console.log(`   Min:  GH₵${config.minPrice}`);
  console.log(`   Label: ${config.label}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

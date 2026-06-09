/**
 * businessPricing.js — Pricing calculation engine for business accounts
 *
 * Priority:
 *   1. Per-business custom override  (BusinessPricingConfig where businessId = <id>)
 *   2. Global business default       (BusinessPricingConfig where businessId = null)
 *   3. Standard individual rate      (PricingConfig — always the fallback)
 *
 * All config values live in the database so admins can change them
 * without any code deployment.
 */

/**
 * Calculate the delivery price for an order.
 *
 * @param {object} prisma      - PrismaClient instance
 * @param {object} opts
 * @param {number} opts.distanceKm   - Haversine distance in kilometres
 * @param {string} opts.accountType  - 'INDIVIDUAL' | 'BUSINESS'
 * @param {string|null} opts.businessId - Business ID (null for individual orders)
 *
 * @returns {{ estimatedPrice: number, businessSaving: number, rateUsed: string }}
 */
async function calculatePrice(prisma, { distanceKm, accountType, businessId }) {
  // ── 1. Always load the standard individual rate ──────────────────────────
  let standardConfig = await prisma.pricingConfig.findFirst();

  // Safety fallback if no PricingConfig row exists yet
  if (!standardConfig) {
    standardConfig = { basePrice: 5.0, pricePerKm: 4.0, minPrice: 8.0 };
  }

  const standardPrice = Math.max(
    standardConfig.minPrice,
    standardConfig.basePrice + distanceKm * standardConfig.pricePerKm
  );

  // ── 2. Return standard price for non-business orders ─────────────────────
  if (accountType !== 'BUSINESS' || !businessId) {
    return {
      estimatedPrice: parseFloat(standardPrice.toFixed(2)),
      businessSaving: 0,
      rateUsed: 'STANDARD',
    };
  }

  // ── 3. Load business pricing (specific override → global default) ─────────
  let bizConfig = null;

  // Try per-business custom rate first
  bizConfig = await prisma.businessPricingConfig.findUnique({
    where: { businessId },
  });

  // Fall back to global business default (businessId = null)
  if (!bizConfig || !bizConfig.isActive) {
    bizConfig = await prisma.businessPricingConfig.findFirst({
      where: { businessId: null, isActive: true },
    });
  }

  // If still nothing, fall back to standard rate
  if (!bizConfig) {
    return {
      estimatedPrice: parseFloat(standardPrice.toFixed(2)),
      businessSaving: 0,
      rateUsed: 'STANDARD_FALLBACK',
    };
  }

  // ── 4. Compute business price ─────────────────────────────────────────────
  const businessPrice = Math.max(
    bizConfig.minPrice,
    bizConfig.basePrice + distanceKm * bizConfig.pricePerKm
  );

  // Apply any additional percentage discount (used by Release 2 tier logic)
  const discounted = bizConfig.discountPercent > 0
    ? businessPrice * (1 - bizConfig.discountPercent / 100)
    : businessPrice;

  const finalPrice   = Math.max(bizConfig.minPrice, discounted);
  const saving       = Math.max(0, standardPrice - finalPrice);

  return {
    estimatedPrice: parseFloat(finalPrice.toFixed(2)),
    businessSaving: parseFloat(saving.toFixed(2)),
    rateUsed: 'BUSINESS',
  };
}

module.exports = { calculatePrice };

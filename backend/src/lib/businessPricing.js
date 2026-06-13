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
 * @param {number} opts.distanceKm    - Haversine distance in kilometres
 * @param {string} opts.accountType   - 'INDIVIDUAL' | 'BUSINESS'
 * @param {string|null} opts.businessId  - Business ID (null for individual orders)
 * @param {string|null} opts.userId   - User ID (used to look up per-customer discount)
 *
 * @returns {{ estimatedPrice: number, businessSaving: number, individualSaving: number, rateUsed: string }}
 */
async function calculatePrice(prisma, { distanceKm, accountType, businessId, userId }) {
  // ── 1. Always load the standard individual rate ──────────────────────────
  let standardConfig = await prisma.pricingConfig.findFirst();

  // Safety fallback if no PricingConfig row exists yet
  if (!standardConfig) {
    standardConfig = { basePrice: 5.0, pricePerKm: 4.0, minPrice: 8.0, discountPercent: 0 };
  }

  const fullStandardPrice = Math.max(
    standardConfig.minPrice,
    standardConfig.basePrice + distanceKm * standardConfig.pricePerKm
  );

  // ── 2. Apply individual discount (global or per-customer override) ────────
  if (accountType !== 'BUSINESS' || !businessId) {
    let discountPct = standardConfig.discountPercent ?? 0;

    // Per-customer override wins if it's higher than the global rate
    if (userId) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { discountPercent: true },
      });
      if (userRecord?.discountPercent > 0) {
        discountPct = userRecord.discountPercent;
      }
    }

    const discountedPrice = discountPct > 0
      ? Math.max(0, fullStandardPrice * (1 - discountPct / 100))
      : fullStandardPrice;

    const individualSaving = Math.max(0, fullStandardPrice - discountedPrice);

    return {
      estimatedPrice: parseFloat(discountedPrice.toFixed(2)),
      businessSaving: 0,
      individualSaving: parseFloat(individualSaving.toFixed(2)),
      discountPercent: discountPct,
      rateUsed: discountPct > 0 ? 'INDIVIDUAL_DISCOUNTED' : 'STANDARD',
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
      estimatedPrice: parseFloat(fullStandardPrice.toFixed(2)),
      businessSaving: 0,
      individualSaving: 0,
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
  const saving       = Math.max(0, fullStandardPrice - finalPrice);

  return {
    estimatedPrice: parseFloat(finalPrice.toFixed(2)),
    businessSaving: parseFloat(saving.toFixed(2)),
    individualSaving: 0,
    rateUsed: 'BUSINESS',
  };
}

module.exports = { calculatePrice };

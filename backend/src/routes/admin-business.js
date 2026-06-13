/**
 * admin-business.js — Admin routes for managing business accounts
 * All routes require: authenticate + authorize('ADMIN')
 */

const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification }      = require('../lib/notifications');
const { UPLOAD_BASE }             = require('../lib/upload');
const {
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
} = require('../lib/email');

const adminOnly = [authenticate, authorize('ADMIN')];

// Valid verification status transitions enforced server-side
const ALLOWED_TRANSITIONS = {
  PENDING:      ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED:     ['SUSPENDED'],
  REJECTED:     ['UNDER_REVIEW'],
  SUSPENDED:    ['APPROVED', 'REJECTED'],
};

// ── GET /api/v1/admin/businesses/stats ────────────────────────────────────
// Aggregate stats for the admin business overview panel
router.get('/businesses/stats', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, byStatus, byType, newThisMonth] = await Promise.all([
      prisma.business.count(),
      prisma.business.groupBy({ by: ['verificationStatus'], _count: { id: true } }),
      prisma.business.groupBy({ by: ['businessType'], _count: { id: true } }),
      prisma.business.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);

    const statusMap = {};
    for (const s of byStatus) statusMap[s.verificationStatus] = s._count.id;

    const typeMap = {};
    for (const t of byType) typeMap[t.businessType] = t._count.id;

    res.json({ total, byStatus: statusMap, byType: typeMap, newThisMonth });
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/businesses ──────────────────────────────────────────
// Paginated list of all businesses with optional filters
router.get('/businesses', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.verificationStatus = status;
    if (type)   where.businessType = type;
    if (search) {
      where.OR = [
        { businessName:  { contains: search, mode: 'insensitive' } },
        { email:         { contains: search, mode: 'insensitive' } },
        { ownerFullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip:    (+page - 1) * +limit,
        take:    +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { documents: true } },
        },
      }),
      prisma.business.count({ where }),
    ]);

    // Compute how many documents are APPROVED per business
    const businessIds = businesses.map(b => b.id);
    const approvedDocCounts = await prisma.businessDocument.groupBy({
      by: ['businessId'],
      where: { businessId: { in: businessIds }, status: 'APPROVED' },
      _count: { id: true },
    });
    const approvedMap = {};
    for (const row of approvedDocCounts) approvedMap[row.businessId] = row._count.id;

    const enriched = businesses.map(b => ({
      id:                 b.id,
      businessName:       b.businessName,
      businessType:       b.businessType,
      ownerFullName:      b.ownerFullName,
      email:              b.email,
      phone:              b.phone,
      verificationStatus: b.verificationStatus,
      isActive:           b.isActive,
      totalDeliveries:    b.totalDeliveries,
      totalSpend:         b.totalSpend,
      createdAt:          b.createdAt,
      documentsCount:     b._count.documents,
      documentsApproved:  approvedMap[b.id] || 0,
    }));

    res.json({ businesses: enriched, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/businesses/:id ──────────────────────────────────────
// Full business detail including documents and stats
router.get('/businesses/:id', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: {
        documents:    true,
        pricingConfig: true,
        owner: { select: { id: true, email: true, createdAt: true } },
      },
    });
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(business);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/admin/businesses/:id/verify ─────────────────────────────
// Change business verification status with enforced transition rules
router.patch('/businesses/:id/verify', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { status, reason } = req.body;

    const validStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }
    if (status === 'REJECTED' && !reason) {
      return res.status(400).json({ error: 'reason is required when rejecting a business' });
    }

    const business = await prisma.business.findUnique({ where: { id: req.params.id } });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    // Enforce allowed transitions
    const allowed = ALLOWED_TRANSITIONS[business.verificationStatus] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${business.verificationStatus} to ${status}`,
        allowedTransitions: allowed,
      });
    }

    const updated = await prisma.business.update({
      where: { id: req.params.id },
      data: {
        verificationStatus: status,
        rejectionReason:    status === 'REJECTED' ? reason : null,
        reviewedBy:         req.user.id,
        reviewedAt:         new Date(),
        ...(status === 'SUSPENDED' && { isActive: false }),
        ...(status === 'APPROVED'  && { isActive: true }),
      },
    });

    // Send notification to business owner
    const notifMap = {
      APPROVED: {
        title:   '🎉 Business Account Approved!',
        message: 'Your business account has been verified. You can now place deliveries at business rates.',
        type:    'business_approved',
      },
      REJECTED: {
        title:   'Business Verification Rejected',
        message: reason || 'Your business account was not approved. Please contact support.',
        type:    'business_rejected',
      },
      SUSPENDED: {
        title:   'Business Account Suspended',
        message: reason || 'Your business account has been suspended. Please contact support.',
        type:    'business_suspended',
      },
      UNDER_REVIEW: {
        title:   'Documents Under Review',
        message: 'Your documents are currently being reviewed. We\'ll notify you shortly.',
        type:    'business_under_review',
      },
    };

    if (notifMap[status]) {
      await createNotification(prisma, {
        userId:  business.ownerId,
        ...notifMap[status],
      });
    }

    // Email the business owner on APPROVED or REJECTED
    if (status === 'APPROVED' || status === 'REJECTED') {
      const owner = await prisma.user.findUnique({
        where: { id: business.ownerId },
        select: { name: true, email: true },
      });
      if (owner) {
        if (status === 'APPROVED') {
          sendBusinessApprovedEmail({
            to: owner.email,
            name: owner.name,
            businessName: business.businessName,
          }).catch(() => {});
        } else {
          sendBusinessRejectedEmail({
            to: owner.email,
            name: owner.name,
            businessName: business.businessName,
            reason,
          }).catch(() => {});
        }
      }
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/admin/businesses/:id/documents/:docId/review ─────────────
// Review a single business document
router.patch('/businesses/:id/documents/:docId/review', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { status, note } = req.body;
    const validStatuses = ['APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    }

    const doc = await prisma.businessDocument.findFirst({
      where: { id: req.params.docId, businessId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const updated = await prisma.businessDocument.update({
      where: { id: req.params.docId },
      data: {
        status,
        reviewNote: note || null,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/businesses/:id/documents/:docId/file ─────────────────
// Stream a document file to admin — NOT publicly accessible
router.get('/businesses/:id/documents/:docId/file', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const doc = await prisma.businessDocument.findFirst({
      where: { id: req.params.docId, businessId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // fileUrl is like: /uploads/business/<businessId>/<filename>
    // Strip the leading /uploads/business/ prefix and build the absolute path
    const relativePath = doc.fileUrl.replace('/uploads/business/', '');
    const absolutePath = path.join(UPLOAD_BASE, relativePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    fs.createReadStream(absolutePath).pipe(res);
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/businesses/pricing ──────────────────────────────────
// Get the global business pricing default
router.get('/businesses/pricing', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    let config = await prisma.businessPricingConfig.findFirst({
      where: { businessId: null },
    });
    // Auto-create if missing (shouldn't happen after seeding, but safe fallback)
    if (!config) {
      config = await prisma.businessPricingConfig.create({
        data: { businessId: null, pricePerKm: 3.0, basePrice: 5.0, minPrice: 8.0, label: 'Business Rate' },
      });
    }
    res.json(config);
  } catch (err) { next(err); }
});

// ── PUT /api/v1/admin/businesses/pricing ──────────────────────────────────
// Update global business pricing — no code deployment needed
router.put('/businesses/pricing', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { pricePerKm, basePrice, minPrice, discountPercent, label } = req.body;

    if (pricePerKm !== undefined && (isNaN(pricePerKm) || +pricePerKm < 0)) {
      return res.status(400).json({ error: 'pricePerKm must be a non-negative number' });
    }

    let config = await prisma.businessPricingConfig.findFirst({ where: { businessId: null } });

    const updateData = {
      updatedBy: req.user.id,
      ...(pricePerKm !== undefined    && { pricePerKm: +pricePerKm }),
      ...(basePrice !== undefined     && { basePrice: +basePrice }),
      ...(minPrice !== undefined      && { minPrice: +minPrice }),
      ...(discountPercent !== undefined && { discountPercent: +discountPercent }),
      ...(label !== undefined         && { label }),
    };

    if (config) {
      config = await prisma.businessPricingConfig.update({
        where: { id: config.id },
        data: updateData,
      });
    } else {
      config = await prisma.businessPricingConfig.create({
        data: { businessId: null, pricePerKm: 3.0, basePrice: 5.0, minPrice: 8.0, ...updateData },
      });
    }

    res.json(config);
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/businesses/:id/pricing ──────────────────────────────
// Get per-business pricing config (and global default for comparison)
router.get('/businesses/:id/pricing', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const [perBusiness, global] = await Promise.all([
      prisma.businessPricingConfig.findUnique({ where: { businessId: req.params.id } }),
      prisma.businessPricingConfig.findFirst({ where: { businessId: null } }),
    ]);
    res.json({ perBusiness: perBusiness || null, global: global || null });
  } catch (err) { next(err); }
});

// ── PUT /api/v1/admin/businesses/:id/pricing ───────────────────────────────
// Create or update per-business pricing override (including custom discount %)
router.put('/businesses/:id/pricing', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { pricePerKm, basePrice, minPrice, discountPercent, label } = req.body;

    if (discountPercent !== undefined && (+discountPercent < 0 || +discountPercent > 100)) {
      return res.status(400).json({ error: 'discountPercent must be between 0 and 100' });
    }

    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      select: { id: true, businessName: true },
    });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    // Use global defaults as base if no per-business value provided
    const globalCfg = await prisma.businessPricingConfig.findFirst({ where: { businessId: null } });

    const data = {
      updatedBy:       req.user.id,
      pricePerKm:      pricePerKm      !== undefined ? +pricePerKm      : (globalCfg?.pricePerKm ?? 3.0),
      basePrice:       basePrice       !== undefined ? +basePrice       : (globalCfg?.basePrice  ?? 5.0),
      minPrice:        minPrice        !== undefined ? +minPrice        : (globalCfg?.minPrice   ?? 8.0),
      discountPercent: discountPercent !== undefined ? +discountPercent : 0,
      label:           label?.trim()  || `${business.businessName} Rate`,
      isActive:        true,
    };

    const config = await prisma.businessPricingConfig.upsert({
      where:  { businessId: req.params.id },
      update: data,
      create: { businessId: req.params.id, ...data },
    });
    res.json(config);
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/admin/businesses/:id/pricing ────────────────────────────
// Remove per-business override — reverts to global default rate
router.delete('/businesses/:id/pricing', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const existing = await prisma.businessPricingConfig.findUnique({
      where: { businessId: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'No custom pricing set for this business' });
    await prisma.businessPricingConfig.delete({ where: { businessId: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

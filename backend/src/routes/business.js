/**
 * business.js — Business account routes
 * All routes require: authenticate + requireBusiness (from middleware/auth)
 * Order-related routes additionally require: requireApproved
 */

const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const { authenticate, requireBusiness, requireApproved } = require('../middleware/auth');
const { upload, UPLOAD_BASE } = require('../lib/upload');
const { createNotification } = require('../lib/notifications');

const bizAuth = [authenticate, requireBusiness];

// ── GET /api/v1/business/profile ───────────────────────────────────────────
// Returns the current business's full profile
router.get('/profile', ...bizAuth, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user.id },
    });
    if (!business) return res.status(404).json({ error: 'Business profile not found' });
    res.json(business);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/business/profile ────────────────────────────────────────
// Allows editing contact/address fields only (name/type/ownerFullName locked after registration)
router.patch('/profile', ...bizAuth, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { phone, businessAddress, gpsAddress } = req.body;

    const business = await prisma.business.findUnique({ where: { ownerId: req.user.id } });
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...(phone           && { phone: phone.trim() }),
        ...(businessAddress && { businessAddress: businessAddress.trim() }),
        ...(gpsAddress !== undefined && { gpsAddress: gpsAddress?.trim() || null }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── GET /api/v1/business/dashboard ────────────────────────────────────────
// Main dashboard data — visible even while PENDING (shows verification status banner)
router.get('/dashboard', ...bizAuth, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user.id },
      include: { pricingConfig: true },
    });
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayOrders, pendingOrders, completedOrders, recentOrders] = await Promise.all([
      prisma.order.count({
        where: { businessId: business.id, createdAt: { gte: startOfDay } },
      }),
      prisma.order.count({
        where: {
          businessId: business.id,
          status: { in: ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'] },
        },
      }),
      prisma.order.count({
        where: { businessId: business.id, status: 'DELIVERED' },
      }),
      prisma.order.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id:             true,
          pickupAddress:  true,
          dropoffAddress: true,
          status:         true,
          estimatedPrice: true,
          finalPrice:     true,
          businessSaving: true,
          createdAt:      true,
          deliveredAt:    true,
        },
      }),
    ]);

    // Load global business pricing for display
    let pricingDisplay = business.pricingConfig;
    if (!pricingDisplay) {
      pricingDisplay = await prisma.businessPricingConfig.findFirst({
        where: { businessId: null, isActive: true },
      });
    }

    res.json({
      business: {
        id:                 business.id,
        businessName:       business.businessName,
        businessType:       business.businessType,
        verificationStatus: business.verificationStatus,
        rejectionReason:    business.rejectionReason,
        isActive:           business.isActive,
      },
      stats: {
        todayOrders,
        monthlyDeliveries:  business.monthlyDeliveries,
        totalDeliveries:    business.totalDeliveries,
        totalSpend:         business.totalSpend,
        pendingOrders,
        completedOrders,
      },
      recentOrders,
      pricing: pricingDisplay
        ? {
            pricePerKm:     pricingDisplay.pricePerKm,
            basePrice:      pricingDisplay.basePrice,
            minPrice:       pricingDisplay.minPrice,
            label:          pricingDisplay.label,
          }
        : null,
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/business/documents ───────────────────────────────────────
// Upload a verification document (max 5 MB; JPG / PNG / PDF only)
// Uses upsert so re-uploading replaces the old record for that doc type
router.post(
  '/documents',
  ...bizAuth,
  upload.single('file'),
  async (req, res, next) => {
    const prisma = req.app.get('prisma');
    try {
      const { type } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const validTypes = ['GHANA_CARD_FRONT', 'GHANA_CARD_BACK', 'BUSINESS_REGISTRATION', 'TIN', 'BUSINESS_PERMIT'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
      }

      const business = await prisma.business.findUnique({ where: { ownerId: req.user.id } });
      if (!business) return res.status(404).json({ error: 'Business profile not found' });

      // Build the stored path relative to UPLOAD_BASE
      const fileUrl = `/uploads/business/${business.id}/${file.filename}`;

      // Upsert — one slot per document type per business
      const doc = await prisma.businessDocument.upsert({
        where: {
          businessId_type: { businessId: business.id, type },
        },
        update: {
          fileUrl,
          fileName:     file.originalname,
          mimeType:     file.mimetype,
          fileSizeBytes: file.size,
          status:       'PENDING',  // Reset to PENDING on re-upload
          reviewNote:   null,
          reviewedBy:   null,
          reviewedAt:   null,
          uploadedAt:   new Date(),
        },
        create: {
          businessId:   business.id,
          type,
          fileUrl,
          fileName:     file.originalname,
          mimeType:     file.mimetype,
          fileSizeBytes: file.size,
          status:       'PENDING',
        },
      });

      // If business was REJECTED and now re-uploads, bump status back to PENDING
      if (business.verificationStatus === 'REJECTED') {
        await prisma.business.update({
          where: { id: business.id },
          data: { verificationStatus: 'PENDING', rejectionReason: null },
        });
      }

      res.status(201).json({
        id:          doc.id,
        type:        doc.type,
        fileName:    doc.fileName,
        status:      doc.status,
        uploadedAt:  doc.uploadedAt,
      });
    } catch (err) { next(err); }
  }
);

// ── GET /api/v1/business/documents ────────────────────────────────────────
// List all documents for the current business (status shown, no file URLs exposed)
router.get('/documents', ...bizAuth, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const business = await prisma.business.findUnique({ where: { ownerId: req.user.id } });
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const docs = await prisma.businessDocument.findMany({
      where: { businessId: business.id },
      select: {
        id:          true,
        type:        true,
        fileName:    true,
        mimeType:    true,
        fileSizeBytes: true,
        status:      true,
        reviewNote:  true,
        uploadedAt:  true,
        updatedAt:   true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json(docs);
  } catch (err) { next(err); }
});

// ── GET /api/v1/business/orders ───────────────────────────────────────────
// Paginated order history for this business account
router.get('/orders', ...bizAuth, requireApproved, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const business = await prisma.business.findUnique({ where: { ownerId: req.user.id } });
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const where = { businessId: business.id };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip:    (+page - 1) * +limit,
        take:    +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rider: { select: { fullName: true, phone: true, motorPlate: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) { next(err); }
});

module.exports = router;

const router = require('express').Router();
const { authenticate, authorize, optionalAuthenticate } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { calculatePrice } = require('../lib/businessPricing');
const { haversineKm } = require('../lib/geo');
const dispatch = require('../lib/dispatch');
const {
  sendOrderConfirmation,
  sendRiderAssignedEmail,
  sendDeliveryCompleteEmail,
  sendOrderCancelledEmail,
} = require('../lib/email');

async function estimatePrice(prisma, pickupLat, pickupLng, dropLat, dropLng) {
  let config = await prisma.pricingConfig.findFirst();
  if (!config) {
    config = await prisma.pricingConfig.create({
      data: { basePrice: 500, pricePerKm: 100, minPrice: 300, currency: 'GHS' },
    });
  }
  const km = haversineKm(pickupLat, pickupLng, dropLat, dropLng);
  const price = Math.max(config.minPrice, config.basePrice + km * config.pricePerKm);
  return { price: Math.round(price), km: Math.round(km * 10) / 10, config };
}

function riderPayload(rider) {
  if (!rider) return null;
  return {
    id: rider.id,
    fullName: rider.fullName,
    phone: rider.phone,
    profilePhoto: rider.profilePhoto,
    motorPlate: rider.motorPlate,
    motorMake: rider.motorMake,
    motorModel: rider.motorModel,
    motorColor: rider.motorColor,
    lastLat: rider.lastLat,
    lastLng: rider.lastLng,
  };
}

// POST /api/v1/orders/estimate
router.post('/estimate', optionalAuthenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return res.status(400).json({ error: 'All coordinates required' });
    }

    const km = haversineKm(+pickupLat, +pickupLng, +dropoffLat, +dropoffLng);
    const pricingResult = await calculatePrice(prisma, {
      distanceKm: km,
      accountType: req.user?.accountType || 'INDIVIDUAL',
      businessId: req.user?.businessId || null
    });

    res.json({
      estimatedPrice: pricingResult.estimatedPrice,
      distanceKm: Math.round(km * 10) / 10,
      businessSaving: pricingResult.businessSaving,
      rateUsed: pricingResult.rateUsed
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders — customer only
router.post('/', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const {
      pickupAddress, pickupLat, pickupLng,
      pickupContactName, pickupPhone, pickupNotes,
      dropoffAddress, dropoffLat, dropoffLng,
      recipientName, recipientPhone, dropoffNotes,
      packageDescription, packageSize, packagePhotoUrl,
    } = req.body;

    const required = [
      pickupAddress, pickupLat, pickupLng,
      pickupContactName, pickupPhone,
      dropoffAddress, dropoffLat, dropoffLng,
      recipientName, recipientPhone,
    ];
    if (required.some((v) => v === undefined || v === null || v === '')) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // If BUSINESS account, verify they are approved and active before creating an order
    if (req.user.accountType === 'BUSINESS') {
      const business = await prisma.business.findUnique({
        where: { ownerId: req.user.id },
        select: { id: true, verificationStatus: true, isActive: true },
      });
      if (!business) {
        return res.status(404).json({ error: 'Business profile not found' });
      }
      if (!business.isActive) {
        return res.status(403).json({ error: 'Business account is suspended' });
      }
      if (business.verificationStatus !== 'APPROVED') {
        return res.status(403).json({
          error: 'Business account not yet approved',
          verificationStatus: business.verificationStatus,
        });
      }
    }

    const km = haversineKm(+pickupLat, +pickupLng, +dropoffLat, +dropoffLng);
    const pricingResult = await calculatePrice(prisma, {
      distanceKm: km,
      accountType: req.user.accountType,
      businessId: req.user.businessId
    });

    const price = pricingResult.estimatedPrice;
    const businessSaving = req.user.accountType === 'BUSINESS' ? pricingResult.businessSaving : null;
    const businessId = req.user.accountType === 'BUSINESS' ? req.user.businessId : null;

    const order = await prisma.order.create({
      data: {
        customerId: req.user.id,
        pickupAddress,
        pickupLat: +pickupLat,
        pickupLng: +pickupLng,
        pickupContactName,
        pickupPhone,
        pickupNotes: pickupNotes || null,
        dropoffAddress,
        dropoffLat: +dropoffLat,
        dropoffLng: +dropoffLng,
        recipientName,
        recipientPhone,
        dropoffNotes: dropoffNotes || null,
        packageDescription: packageDescription || null,
        packageSize: packageSize || null,
        packagePhotoUrl: packagePhotoUrl || null,
        estimatedPrice: price,
        businessId,
        businessSaving,
      },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
      },
    });

    io.to('admin').emit('order:new', order);

    // Non-blocking confirmation email to customer
    const cust = order.customer;
    sendOrderConfirmation({
      to: cust.email,
      name: cust.name,
      orderId: order.id,
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      estimatedPrice: order.estimatedPrice,
    }).catch(() => {});

    // Geo-proximity dispatch: find nearby available riders and push offer
    // runs after response so the customer never waits for the rider query
    setImmediate(() => dispatch.dispatchOrder(io, prisma, order));

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders
router.get('/', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { status } = req.query;
    let where = {};
    if (req.user.role === 'CUSTOMER') {
      where = { customerId: req.user.id };
    } else if (req.user.role === 'RIDER') {
      const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
      if (!rider) return res.json([]);
      where = { riderId: rider.id };
    } else if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, phone: true } },
        rider: true,
      },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        rider: true,
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const riderRecord = order.riderId
      ? await prisma.rider.findUnique({ where: { id: order.riderId } })
      : null;
    const isOwner = order.customerId === req.user.id;
    const isRider = riderRecord?.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isRider && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    res.json(order);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/orders/:id/status — rider only
router.patch('/:id/status', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const { status, deliveryPhotoUrl, deliverySignature } = req.body;
    const allowed = ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider) return res.status(404).json({ error: 'Rider profile not found' });

    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (existing.riderId !== rider.id) return res.status(403).json({ error: 'Not your order' });

    const data = { status };
    if (status === 'ACCEPTED') data.acceptedAt = new Date();
    if (status === 'PICKED_UP') data.pickedUpAt = new Date();
    if (status === 'DELIVERED') {
      data.deliveredAt = new Date();
      data.finalPrice = existing.finalPrice ?? existing.estimatedPrice;
      if (deliveryPhotoUrl) data.deliveryPhotoUrl = deliveryPhotoUrl;
      if (deliverySignature) data.deliverySignature = deliverySignature;
    }
    if (status === 'CANCELLED') data.cancelledAt = new Date();

    const order = await prisma.order.update({ where: { id: req.params.id }, data });

    if (status === 'DELIVERED') {
      await prisma.rider.update({
        where: { id: rider.id },
        data: {
          totalDeliveries: { increment: 1 },
          totalEarnings: { increment: order.finalPrice || order.estimatedPrice },
          isOnDelivery: false,
        },
      });

      if (order.businessId) {
        await prisma.business.update({
          where: { id: order.businessId },
          data: {
            totalDeliveries: { increment: 1 },
            monthlyDeliveries: { increment: 1 },
            totalSpend: { increment: order.finalPrice || order.estimatedPrice },
          },
        });
      }
    }
    if (['PICKED_UP', 'IN_TRANSIT', 'ARRIVED'].includes(status)) {
      await prisma.rider.update({
        where: { id: rider.id },
        data: { isOnDelivery: true },
      });
    }

    const timestamp = new Date().toISOString();
    io.to(`order:${order.id}`).emit('order:status_changed', { orderId: order.id, status, timestamp });
    io.to('admin').emit('order:status_changed', { orderId: order.id, status, timestamp });
    io.to(`rider:${rider.id}`).emit('order:status_changed', { orderId: order.id, status, timestamp });

    const statusMessages = {
      ACCEPTED: 'Your order has been accepted by a rider',
      PICKED_UP: 'Your rider has picked up your package',
      IN_TRANSIT: 'Your package is on the way',
      ARRIVED: 'Your rider has arrived',
      DELIVERED: 'Your delivery is complete',
    };
    if (statusMessages[status]) {
      await createNotification(prisma, {
        userId: order.customerId,
        title: 'Order update',
        message: statusMessages[status],
        type: 'order_status',
        orderId: order.id,
      });
    }

    // Email notifications for key status transitions
    const customer = await prisma.user.findUnique({
      where: { id: order.customerId },
      select: { name: true, email: true },
    });
    if (customer) {
      if (status === 'ACCEPTED') {
        sendRiderAssignedEmail({
          to: customer.email,
          name: customer.name,
          orderId: order.id,
          riderName: rider.fullName,
          riderPhone: rider.phone,
          motorPlate: rider.motorPlate,
        }).catch(() => {});
      } else if (status === 'DELIVERED') {
        sendDeliveryCompleteEmail({
          to: customer.email,
          name: customer.name,
          orderId: order.id,
          finalPrice: order.finalPrice,
        }).catch(() => {});
      }
    }

    if (status === 'ARRIVED') {
      io.to(`order:${order.id}`).emit('rider:arrived', {
        orderId: order.id,
        message: 'Your rider has arrived!',
      });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders/:id/rate — customer rates delivery
router.post('/:id/rate', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1–5' });
    }
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.customerId !== req.user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'DELIVERED') {
      return res.status(400).json({ error: 'Order not delivered yet' });
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { customerRating: +rating, customerReview: review || null },
    });
    if (order.riderId) {
      const riderOrders = await prisma.order.findMany({
        where: { riderId: order.riderId, customerRating: { not: null } },
        select: { customerRating: true },
      });
      const avg =
        riderOrders.reduce((s, o) => s + o.customerRating, 0) / riderOrders.length;
      await prisma.rider.update({
        where: { id: order.riderId },
        data: { averageRating: Math.round(avg * 10) / 10 },
      });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/orders/:id/cancel — customer only, PENDING orders
router.patch('/:id/cancel', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const timestamp = new Date().toISOString();
    io.to(`order:${order.id}`).emit('order:status_changed', {
      orderId: order.id, status: 'CANCELLED', timestamp,
    });
    io.to('admin').emit('order:status_changed', {
      orderId: order.id, status: 'CANCELLED', timestamp,
    });

    sendOrderCancelledEmail({
      to: req.user.email,
      name: req.user.name,
      orderId: order.id,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

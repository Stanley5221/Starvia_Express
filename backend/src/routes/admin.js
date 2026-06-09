const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { sendRiderTempPasswordEmail } = require('../lib/email');

const adminOnly = [authenticate, authorize('ADMIN')];

router.get('/stats', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalOrders, pendingOrders, activeRiders, totalCustomers, deliveredToday, revenueToday] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: { in: ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'] } } }),
        prisma.rider.count({ where: { isAvailable: true, isApproved: true } }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.order.count({
          where: { status: 'DELIVERED', deliveredAt: { gte: startOfDay } },
        }),
        prisma.order.aggregate({
          where: { status: 'DELIVERED', deliveredAt: { gte: startOfDay } },
          _sum: { finalPrice: true },
        }),
      ]);

    res.json({
      totalOrders,
      pendingOrders,
      activeRiders,
      totalCustomers,
      deliveredToday,
      revenueToday: revenueToday._sum.finalPrice || 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, finalPrice: true, estimatedPrice: true },
    });

    const byDay = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = { date: key, orders: 0, revenue: 0 };
    }
    const statusBreakdown = {};
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (byDay[key]) {
        byDay[key].orders += 1;
        if (o.status === 'DELIVERED') {
          byDay[key].revenue += o.finalPrice ?? o.estimatedPrice ?? 0;
        }
      }
      statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
    }

    const topRiders = await prisma.rider.findMany({
      orderBy: { totalDeliveries: 'desc' },
      take: 5,
      select: { fullName: true, totalDeliveries: true, averageRating: true },
    });

    res.json({
      ordersPerDay: Object.values(byDay).reverse(),
      statusBreakdown,
      topRiders,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (+page - 1) * +limit,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, phone: true, email: true } },
          rider: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) {
    next(err);
  }
});

router.patch('/orders/:id/assign', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  const { cancelDispatch } = require('../lib/dispatch');
  try {
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ error: 'riderId required' });

    const rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider || !rider.isApproved) {
      return res.status(400).json({ error: 'Rider not approved' });
    }

    // Cancel any pending geo-dispatch fallback timer for this order
    cancelDispatch(req.params.id);

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        riderId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: { customer: { select: { name: true, phone: true } } },
    });

    await prisma.rider.update({
      where: { id: riderId },
      data: { isOnDelivery: true, isAvailable: false },
    });

    io.to(`rider:${riderId}`).emit('order:new', {
      orderId: order.id,
      pickup: { address: order.pickupAddress, contactName: order.pickupContactName },
      dropoff: { address: order.dropoffAddress, recipientName: order.recipientName },
      payout: order.estimatedPrice,
      packageSize: order.packageSize,
    });

    const timestamp = new Date().toISOString();
    io.to(`order:${order.id}`).emit('order:assigned', {
      orderId: order.id,
      rider: {
        name: rider.fullName,
        phone: rider.phone,
        motorPlate: rider.motorPlate,
        photo: rider.profilePhoto,
      },
    });
    io.to(`order:${order.id}`).emit('order:status_changed', {
      orderId: order.id,
      status: 'ACCEPTED',
      timestamp,
    });

    await createNotification(prisma, {
      userId: order.customerId,
      title: 'Rider assigned',
      message: `${rider.fullName} will deliver your order`,
      type: 'rider_assigned',
      orderId: order.id,
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.patch('/orders/:id/cancel', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const timestamp = new Date().toISOString();
    io.to(`order:${order.id}`).emit('order:status_changed', { orderId: order.id, status: 'CANCELLED', timestamp });
    io.to('admin').emit('order:status_changed', { orderId: order.id, status: 'CANCELLED', timestamp });
    if (order.riderId) {
      const rider = await prisma.rider.findUnique({ where: { id: order.riderId } });
      if (rider) {
        await createNotification(prisma, {
          userId: rider.userId,
          title: 'Order cancelled',
          message: 'An assigned order was cancelled',
          type: 'order_cancelled',
          orderId: order.id,
        });
      }
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.get('/riders', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { approved } = req.query;
    const where = {};
    if (approved === 'false') where.isApproved = false;
    if (approved === 'true') where.isApproved = true;

    const riders = await prisma.rider.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    res.json(riders);
  } catch (err) {
    next(err);
  }
});

router.patch('/riders/:id/approve', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.update({
      where: { id: req.params.id },
      data: { isApproved: true },
    });
    await createNotification(prisma, {
      userId: rider.userId,
      title: 'Application approved',
      message: 'You can now go online and accept deliveries',
      type: 'rider_approved',
    });
    res.json(rider);
  } catch (err) {
    next(err);
  }
});

router.patch('/riders/:id/reject', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { reason } = req.body;
    const rider = await prisma.rider.update({
      where: { id: req.params.id },
      data: { isApproved: false },
    });
    await createNotification(prisma, {
      userId: rider.userId,
      title: 'Application not approved',
      message: reason || 'Please contact support for details',
      type: 'rider_rejected',
    });
    res.json(rider);
  } catch (err) {
    next(err);
  }
});

router.get('/riders/live', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const riders = await prisma.rider.findMany({
      where: { isApproved: true, lastLat: { not: null } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
        isAvailable: true,
        isOnDelivery: true,
        motorPlate: true,
      },
    });
    res.json(riders);
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/riders/:id ─── comprehensive rider detail ────────────────────
router.get('/riders/:id', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true, mustChangePassword: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { customer: { select: { name: true, email: true, phone: true } } },
        },
      },
    });
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    res.json(rider);
  } catch (err) { next(err); }
});

// ─── PATCH /admin/riders/:id ─── update rider profile ───────────────────────
router.patch('/riders/:id', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { fullName, phone, motorPlate, motorMake, motorModel, motorColor, licenceNumber, licenceExpiry, profilePhoto } = req.body;
    const data = {};
    if (fullName)                  data.fullName = fullName;
    if (phone)                     data.phone = phone;
    if (motorPlate)                data.motorPlate = motorPlate;
    if (motorMake)                 data.motorMake = motorMake;
    if (motorModel)                data.motorModel = motorModel;
    if (motorColor)                data.motorColor = motorColor;
    if (licenceNumber)             data.licenceNumber = licenceNumber;
    if (licenceExpiry)             data.licenceExpiry = new Date(licenceExpiry);
    if (profilePhoto !== undefined) data.profilePhoto = profilePhoto || null;
    const rider = await prisma.rider.update({ where: { id: req.params.id }, data });
    res.json(rider);
  } catch (err) { next(err); }
});

// ─── PATCH /admin/riders/:id/suspend ─── toggle suspension ──────────────────
router.patch('/riders/:id/suspend', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const existing = await prisma.rider.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Rider not found' });
    const nowSuspended = !existing.isSuspended;
    const rider = await prisma.rider.update({
      where: { id: req.params.id },
      data: { isSuspended: nowSuspended, ...(nowSuspended ? { isAvailable: false } : {}) },
    });
    await createNotification(prisma, {
      userId: existing.userId,
      title: nowSuspended ? 'Account suspended' : 'Account reinstated',
      message: nowSuspended
        ? 'Your rider account has been suspended. Contact support for details.'
        : 'Your account has been reinstated. You can now sign in and go online.',
      type: nowSuspended ? 'account_suspended' : 'account_reinstated',
    });
    res.json(rider);
  } catch (err) { next(err); }
});

// ─── DELETE /admin/riders/:id ─── delete rider account ──────────────────────
router.delete('/riders/:id', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({ where: { id: req.params.id } });
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    await prisma.$transaction(async (tx) => {
      // Re-queue active orders so they don't disappear
      await tx.order.updateMany({
        where: { riderId: req.params.id, status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'] } },
        data: { riderId: null, status: 'PENDING', acceptedAt: null },
      });
      // Null-out riderId on completed/cancelled orders to preserve history
      await tx.order.updateMany({ where: { riderId: req.params.id }, data: { riderId: null } });
      await tx.rider.delete({ where: { id: req.params.id } });
      await tx.user.delete({ where: { id: rider.userId } });
    });
    res.json({ message: 'Rider account deleted' });
  } catch (err) { next(err); }
});

// ─── POST /admin/riders/:id/reset-password ───────────────────────────────────
router.post('/riders/:id/reset-password', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await prisma.user.update({
      where: { id: rider.userId },
      data: { passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true },
    });
    sendRiderTempPasswordEmail({ to: rider.user.email, name: rider.fullName, tempPassword }).catch(() => {});
    res.json({ temporaryPassword: tempPassword, name: rider.fullName, email: rider.user.email });
  } catch (err) { next(err); }
});

router.get('/pricing', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    let config = await prisma.pricingConfig.findFirst();
    if (!config) config = await prisma.pricingConfig.create({ data: {} });
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.put('/pricing', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { basePrice, pricePerKm, minPrice, currency } = req.body;
    let config = await prisma.pricingConfig.findFirst();
    if (!config) {
      config = await prisma.pricingConfig.create({
        data: { basePrice, pricePerKm, minPrice, currency, updatedBy: req.user.id },
      });
    } else {
      config = await prisma.pricingConfig.update({
        where: { id: config.id },
        data: { basePrice, pricePerKm, minPrice, currency, updatedBy: req.user.id },
      });
    }
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.get('/dispatch', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    let cfg = await prisma.dispatchConfig.findFirst();
    if (!cfg) cfg = await prisma.dispatchConfig.create({ data: {} });
    res.json(cfg);
  } catch (err) { next(err); }
});

router.put('/dispatch', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const { invalidateDispatchCache } = require('../lib/dispatch');
  try {
    const { radiusKm, fallbackSecs, locationFreshMins } = req.body;
    if (typeof radiusKm !== 'number' || radiusKm < 0.5 || radiusKm > 50)
      return res.status(400).json({ error: 'radiusKm must be between 0.5 and 50' });
    if (typeof fallbackSecs !== 'number' || fallbackSecs < 30 || fallbackSecs > 600)
      return res.status(400).json({ error: 'fallbackSecs must be between 30 and 600' });
    if (typeof locationFreshMins !== 'number' || locationFreshMins < 1 || locationFreshMins > 60)
      return res.status(400).json({ error: 'locationFreshMins must be between 1 and 60' });

    let cfg = await prisma.dispatchConfig.findFirst();
    if (cfg) {
      cfg = await prisma.dispatchConfig.update({
        where: { id: cfg.id },
        data:  { radiusKm, fallbackSecs, locationFreshMins, updatedBy: req.user.id },
      });
    } else {
      cfg = await prisma.dispatchConfig.create({
        data: { radiusKm, fallbackSecs, locationFreshMins, updatedBy: req.user.id },
      });
    }
    invalidateDispatchCache();
    res.json(cfg);
  } catch (err) { next(err); }
});

// ── Dispatch Zones CRUD ───────────────────────────────────────────────────────

router.get('/dispatch/zones', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const zones = await prisma.dispatchZone.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(zones);
  } catch (err) { next(err); }
});

router.post('/dispatch/zones', ...adminOnly, async (req, res, next) => {
  const { invalidateZoneCache } = require('../lib/dispatch');
  const prisma = req.app.get('prisma');
  try {
    const { name, centerLat, centerLng, zoneBoundaryKm, dispatchRadiusKm } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Zone name is required' });
    if (centerLat == null || centerLng == null) return res.status(400).json({ error: 'Zone center coordinates are required' });
    if (typeof zoneBoundaryKm !== 'number' || zoneBoundaryKm < 1 || zoneBoundaryKm > 500)
      return res.status(400).json({ error: 'zoneBoundaryKm must be between 1 and 500' });
    if (typeof dispatchRadiusKm !== 'number' || dispatchRadiusKm < 0.5 || dispatchRadiusKm > 50)
      return res.status(400).json({ error: 'dispatchRadiusKm must be between 0.5 and 50' });
    const zone = await prisma.dispatchZone.create({
      data: { name: name.trim(), centerLat, centerLng, zoneBoundaryKm, dispatchRadiusKm, updatedBy: req.user.id },
    });
    invalidateZoneCache();
    res.status(201).json(zone);
  } catch (err) { next(err); }
});

router.put('/dispatch/zones/:id', ...adminOnly, async (req, res, next) => {
  const { invalidateZoneCache } = require('../lib/dispatch');
  const prisma = req.app.get('prisma');
  try {
    const { name, centerLat, centerLng, zoneBoundaryKm, dispatchRadiusKm, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Zone name is required' });
    if (centerLat == null || centerLng == null) return res.status(400).json({ error: 'Zone center coordinates are required' });
    if (typeof zoneBoundaryKm !== 'number' || zoneBoundaryKm < 1 || zoneBoundaryKm > 500)
      return res.status(400).json({ error: 'zoneBoundaryKm must be between 1 and 500' });
    if (typeof dispatchRadiusKm !== 'number' || dispatchRadiusKm < 0.5 || dispatchRadiusKm > 50)
      return res.status(400).json({ error: 'dispatchRadiusKm must be between 0.5 and 50' });
    const existing = await prisma.dispatchZone.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Zone not found' });
    const zone = await prisma.dispatchZone.update({
      where: { id: req.params.id },
      data: { name: name.trim(), centerLat, centerLng, zoneBoundaryKm, dispatchRadiusKm, isActive: isActive ?? existing.isActive, updatedBy: req.user.id },
    });
    invalidateZoneCache();
    res.json(zone);
  } catch (err) { next(err); }
});

router.delete('/dispatch/zones/:id', ...adminOnly, async (req, res, next) => {
  const { invalidateZoneCache } = require('../lib/dispatch');
  const prisma = req.app.get('prisma');
  try {
    const existing = await prisma.dispatchZone.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Zone not found' });
    await prisma.dispatchZone.delete({ where: { id: req.params.id } });
    invalidateZoneCache();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/customers', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        isSuspended: true,
        orders: {
          select: { id: true, status: true, finalPrice: true, estimatedPrice: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = customers.map((c) => {
      const delivered = c.orders.filter((o) => o.status === 'DELIVERED');
      const totalSpent = delivered.reduce((s, o) => s + (o.finalPrice ?? o.estimatedPrice ?? 0), 0);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        createdAt: c.createdAt,
        isSuspended: c.isSuspended,
        totalOrders: c.orders.length,
        totalSpent,
        lastOrderDate: c.orders[0]?.createdAt || null,
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/customers/:id ─── full customer detail ──────────────────────
router.get('/customers/:id', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const customer = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'CUSTOMER' },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { rider: { select: { fullName: true, phone: true, profilePhoto: true } } },
        },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const { passwordHash, ...safe } = customer;
    const delivered = customer.orders.filter(o => o.status === 'DELIVERED');
    res.json({
      ...safe,
      totalDeliveries: delivered.length,
      totalSpent: delivered.reduce((s, o) => s + (o.finalPrice ?? o.estimatedPrice ?? 0), 0),
    });
  } catch (err) { next(err); }
});

// ─── PATCH /admin/customers/:id ─── update customer profile ─────────────────
router.patch('/customers/:id', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { name, phone } = req.body;
    const data = {};
    if (name)              data.name = name;
    if (phone !== undefined) data.phone = phone;
    const customer = await prisma.user.update({ where: { id: req.params.id }, data });
    const { passwordHash, ...safe } = customer;
    res.json(safe);
  } catch (err) { next(err); }
});

// ─── PATCH /admin/customers/:id/suspend ─── toggle suspension ───────────────
router.patch('/customers/:id/suspend', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });
    const customer = await prisma.user.update({
      where: { id: req.params.id },
      data: { isSuspended: !existing.isSuspended },
    });
    const { passwordHash, ...safe } = customer;
    res.json(safe);
  } catch (err) { next(err); }
});

// ─── DELETE /admin/customers/:id ─────────────────────────────────────────────
router.delete('/customers/:id', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const orderCount = await prisma.order.count({ where: { customerId: req.params.id } });
    if (orderCount > 0) {
      return res.status(400).json({
        error: `Cannot delete: customer has ${orderCount} order(s). Suspend the account instead to disable access.`,
      });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Customer deleted' });
  } catch (err) { next(err); }
});

// ─── POST /api/v1/admin/riders ───────────────────────────────────────────────
// Admin creates a rider account directly (closed fleet model).
// Rider is auto-approved. A temporary password is generated, shown once, and
// the rider must change it on first login (mustChangePassword: true).
router.post('/riders', ...adminOnly, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const {
      fullName, email, phone,
      motorPlate, motorMake, motorModel, motorColor, motorPhoto,
      licenceNumber, licenceExpiry, licencePhoto, profilePhoto,
    } = req.body;

    // Validate required fields
    const required = { fullName, email, phone, motorPlate, motorMake, motorModel, motorColor, licenceNumber, licenceExpiry };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Generate a secure temporary password (shown once to admin)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Atomic transaction: create User + Rider record
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name:               fullName,
          email,
          phone,
          passwordHash,
          role:               'RIDER',
          mustChangePassword: true,  // Forces password change on first login
        },
      });

      const rider = await tx.rider.create({
        data: {
          userId:        user.id,
          fullName,
          phone,
          profilePhoto:  profilePhoto || null,
          motorPlate,
          motorMake,
          motorModel,
          motorColor,
          motorPhoto:    motorPhoto || null,
          licenceNumber,
          licenceExpiry: new Date(licenceExpiry),
          licencePhoto:  licencePhoto || null,
          isApproved:    true,   // Auto-approved — admin has already vetted offline
          isAvailable:   false,
          isOnDelivery:  false,
        },
      });

      return { user, rider };
    });

    // Email the rider their login credentials (non-blocking)
    sendRiderTempPasswordEmail({ to: email, name: fullName, tempPassword }).catch(() => {});

    res.status(201).json({
      message:       'Rider account created successfully',
      riderId:       result.rider.id,
      userId:        result.user.id,
      name:          fullName,
      email,
      // Temp password returned ONCE — admin must give this to the rider
      temporaryPassword: tempPassword,
      note: 'The rider will be prompted to change this password on first login.',
    });
  } catch (err) { next(err); }
});

router.post('/seed', async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { secret, name, email, password } = req.body;
    if (secret !== (process.env.ADMIN_SEED_SECRET || 'starvia-delivery-admin-seed')) {
      return res.status(403).json({ error: 'Invalid seed secret' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Admin already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: { name, email, passwordHash, role: 'ADMIN' },
    });
    res.status(201).json({ message: 'Admin created', id: admin.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

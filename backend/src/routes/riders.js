const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification, notifyAdmins } = require('../lib/notifications');
const { cancelDispatch } = require('../lib/dispatch');

// POST /api/v1/riders/register — rider onboarding
router.post('/register', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const {
      fullName, phone, profilePhoto,
      motorPlate, motorMake, motorModel, motorColor, motorPhoto,
      licenceNumber, licenceExpiry, licencePhoto,
    } = req.body;

    if (!fullName || !phone || !motorPlate || !motorMake || !motorModel || !motorColor || !licenceNumber || !licenceExpiry) {
      return res.status(400).json({ error: 'All required rider fields must be provided' });
    }

    const existing = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (existing) return res.status(409).json({ error: 'Rider profile already exists' });

    const rider = await prisma.rider.create({
      data: {
        userId: req.user.id,
        fullName,
        phone,
        profilePhoto: profilePhoto || null,
        motorPlate,
        motorMake,
        motorModel,
        motorColor,
        motorPhoto: motorPhoto || null,
        licenceNumber,
        licenceExpiry: new Date(licenceExpiry),
        licencePhoto: licencePhoto || null,
      },
    });

    await notifyAdmins(prisma, {
      title: 'New rider application',
      message: `${fullName} has registered and is awaiting approval`,
      type: 'new_rider',
    });

    io.to('admin').emit('rider:new', rider);
    res.status(201).json(rider);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const {
      profilePhoto,
      fullName, phone,
      motorPlate, motorMake, motorModel, motorColor,
      licenceNumber, licenceExpiry,
    } = req.body;

    const data = {};
    if (profilePhoto)   data.profilePhoto  = profilePhoto;
    if (fullName)       data.fullName       = fullName.trim();
    if (phone)          data.phone          = phone.trim();
    if (motorPlate)     data.motorPlate     = motorPlate.trim().toUpperCase();
    if (motorMake)      data.motorMake      = motorMake.trim();
    if (motorModel)     data.motorModel     = motorModel.trim();
    if (motorColor)     data.motorColor     = motorColor.trim();
    if (licenceNumber)  data.licenceNumber  = licenceNumber.trim();
    if (licenceExpiry)  data.licenceExpiry  = new Date(licenceExpiry);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const rider = await prisma.rider.update({
      where: { userId: req.user.id },
      data,
    });
    res.json(rider);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    if (!rider) return res.status(404).json({ error: 'Rider profile not found' });
    res.json(rider);
  } catch (err) {
    next(err);
  }
});

router.get('/profile', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } },
    });
    if (!rider) return res.status(404).json({ error: 'Rider profile not found' });
    res.json({
      ...rider,
      riderId: `RD-${rider.id.slice(-5).toUpperCase()}`,
      accountStatus: rider.isApproved ? 'APPROVED' : 'PENDING',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider) return res.status(404).json({ error: 'Rider profile not found' });

    const { status } = req.query;
    const where = { riderId: rider.id };
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, phone: true } } },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.get('/orders/active', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider) return res.status(404).json({ error: 'Rider profile not found' });

    const order = await prisma.order.findFirst({
      where: {
        riderId: rider.id,
        status: { in: ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, phone: true } } },
    });
    res.json(order ?? null);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/riders/availability
router.patch('/availability', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const { isAvailable } = req.body;
    const rider = await prisma.rider.update({
      where: { userId: req.user.id },
      data: { isAvailable: !!isAvailable },
    });
    if (rider.isAvailable) {
      io.to(`rider:${rider.id}`).emit('rider:available', { riderId: rider.id });
    }
    io.to('admin').emit('rider:availability', { riderId: rider.id, isAvailable: rider.isAvailable });
    res.json({ isAvailable: rider.isAvailable });
  } catch (err) {
    next(err);
  }
});

// Legacy alias for rider app
router.patch('/online', authenticate, authorize('RIDER'), async (req, res, next) => {
  req.body.isAvailable = req.body.isOnline ?? req.body.isAvailable;
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const rider = await prisma.rider.update({
      where: { userId: req.user.id },
      data: { isAvailable: !!req.body.isAvailable },
    });
    io.to('admin').emit('rider:availability', { riderId: rider.id, isAvailable: rider.isAvailable });
    res.json({ isOnline: rider.isAvailable, isAvailable: rider.isAvailable });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/riders/push-token — store Expo push token for this rider
router.post('/push-token', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({ error: 'pushToken required' });
    }
    await prisma.rider.update({
      where: { userId: req.user.id },
      data:  { pushToken },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/riders/location — idle location heartbeat (when not on a delivery)
router.post('/location', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat and lng must be numbers' });
    }
    await prisma.rider.update({
      where: { userId: req.user.id },
      data:  { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/riders/orders/:id/accept
router.post('/orders/:id/accept', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider || !rider.isApproved || rider.isSuspended) {
      return res.status(403).json({ error: 'Rider not eligible' });
    }

    // Atomic guard: only succeeds if order is still PENDING and unclaimed
    const result = await prisma.order.updateMany({
      where: { id: req.params.id, status: 'PENDING', riderId: null },
      data:  { riderId: rider.id, status: 'ACCEPTED', acceptedAt: new Date() },
    });

    if (result.count === 0) {
      return res.status(409).json({ error: 'Order already accepted by another rider' });
    }

    // Cancel the 90-second admin fallback timer
    cancelDispatch(req.params.id);

    await prisma.rider.update({
      where: { id: rider.id },
      data:  { isOnDelivery: true, isAvailable: false },
    });

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    const timestamp = new Date().toISOString();

    io.to(`order:${order.id}`).emit('order:assigned', {
      orderId: order.id,
      rider: {
        name:       rider.fullName,
        phone:      rider.phone,
        motorPlate: rider.motorPlate,
        photo:      rider.profilePhoto,
      },
    });
    io.to(`order:${order.id}`).emit('order:status_changed', { orderId: order.id, status: 'ACCEPTED', timestamp });
    io.to('admin').emit('order:status_changed', { orderId: order.id, status: 'ACCEPTED', timestamp });

    await createNotification(prisma, {
      userId:  order.customerId,
      title:   'Rider assigned',
      message: `${rider.fullName} is handling your delivery`,
      type:    'rider_assigned',
      orderId: order.id,
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/reject', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  const io = req.app.get('io');
  try {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.riderId === rider?.id) {
      await prisma.order.update({
        where: { id: order.id },
        data: { riderId: null, status: 'PENDING' },
      });
    }

    io.to('admin').emit('order:rejected', { orderId: order.id, riderId: rider?.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function periodStart(period) {
  const now = new Date();
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function orderAmount(o) {
  return o.finalPrice ?? o.estimatedPrice ?? 0;
}

router.get('/earnings/summary', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider) return res.status(404).json({ error: 'Rider profile not found' });

    const [todayOrders, weekOrders, monthOrders] = await Promise.all([
      prisma.order.findMany({
        where: { riderId: rider.id, status: 'DELIVERED', deliveredAt: { gte: periodStart('today') } },
        select: { finalPrice: true, estimatedPrice: true },
      }),
      prisma.order.findMany({
        where: { riderId: rider.id, status: 'DELIVERED', deliveredAt: { gte: periodStart('week') } },
        select: { finalPrice: true, estimatedPrice: true },
      }),
      prisma.order.findMany({
        where: { riderId: rider.id, status: 'DELIVERED', deliveredAt: { gte: periodStart('month') } },
        select: { finalPrice: true, estimatedPrice: true },
      }),
    ]);

    res.json({
      today: {
        earnings: todayOrders.reduce((s, o) => s + orderAmount(o), 0),
        deliveries: todayOrders.length,
      },
      week: {
        earnings: weekOrders.reduce((s, o) => s + orderAmount(o), 0),
        deliveries: weekOrders.length,
      },
      month: {
        earnings: monthOrders.reduce((s, o) => s + orderAmount(o), 0),
        deliveries: monthOrders.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/earnings', authenticate, authorize('RIDER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider) return res.status(404).json({ error: 'Rider profile not found' });

    const period = req.query.period || 'today';
    const since = periodStart(period);

    const orders = await prisma.order.findMany({
      where: {
        riderId: rider.id,
        status: 'DELIVERED',
        deliveredAt: { gte: since },
      },
      orderBy: { deliveredAt: 'desc' },
      select: {
        id: true,
        pickupAddress: true,
        dropoffAddress: true,
        recipientName: true,
        deliveredAt: true,
        finalPrice: true,
        estimatedPrice: true,
        customerRating: true,
      },
    });

    const total = orders.reduce((s, o) => s + orderAmount(o), 0);
    const rated = orders.filter((o) => o.customerRating != null);
    const avgRating = rated.length
      ? rated.reduce((s, o) => s + o.customerRating, 0) / rated.length
      : rider.averageRating;

    res.json({
      period,
      total,
      deliveries: orders.length,
      avgPerJob: orders.length ? Math.round(total / orders.length) : 0,
      avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      breakdown: orders.map((o) => ({
        orderId: o.id,
        route: `${shortArea(o.pickupAddress)} → ${shortArea(o.dropoffAddress)}`,
        recipientName: o.recipientName,
        deliveredAt: o.deliveredAt,
        amount: orderAmount(o),
        rating: o.customerRating,
      })),
    });
  } catch (err) {
    next(err);
  }
});

function shortArea(address) {
  if (!address) return 'Unknown';
  const part = address.split(',')[0];
  return part.length > 28 ? `${part.slice(0, 28)}…` : part;
}

module.exports = router;

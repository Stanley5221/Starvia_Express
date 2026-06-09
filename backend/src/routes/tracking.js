const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

// GET /api/tracking/order/:id — last known rider location for an order
router.get('/order/:id', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { rider: { select: { id: true, lastLat: true, lastLng: true, lastLocationAt: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Only owner or admin
    const isOwner = order.customerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    res.json({
      orderId: order.id,
      status: order.status,
      rider: order.rider
        ? { id: order.rider.id, lat: order.rider.lastLat, lng: order.rider.lastLng, at: order.rider.lastLocationAt }
        : null,
    });
  } catch (err) { next(err); }
});

// GET /api/tracking/order/:id/trail — full GPS trail for an order
router.get('/order/:id/trail', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || !order.riderId) return res.status(404).json({ error: 'No rider assigned' });

    const trail = await prisma.riderLocation.findMany({
      where: {
        riderId: order.riderId,
        timestamp: {
          gte: order.acceptedAt || order.createdAt,
        },
      },
      orderBy: { timestamp: 'asc' },
      take: 500,
    });

    res.json(trail);
  } catch (err) { next(err); }
});

module.exports = router;

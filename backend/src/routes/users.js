const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/me/push-token', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { pushToken } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { pushToken: pushToken || null },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/me', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/me/password', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me/stats', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      select: { status: true, finalPrice: true, estimatedPrice: true },
    });
    const delivered = orders.filter((o) => o.status === 'DELIVERED');
    const totalSpent = delivered.reduce((s, o) => s + (o.finalPrice ?? o.estimatedPrice ?? 0), 0);
    res.json({ totalOrders: orders.length, totalSpent });
  } catch (err) {
    next(err);
  }
});

router.get('/me/addresses', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const addresses = await prisma.savedAddress.findMany({
      where: { userId: req.user.id },
      orderBy: { label: 'asc' },
    });
    res.json(addresses);
  } catch (err) {
    next(err);
  }
});

router.post('/me/addresses', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { label, address, lat, lng } = req.body;
    if (!label || !address || lat == null || lng == null) {
      return res.status(400).json({ error: 'label, address, lat, lng required' });
    }
    const saved = await prisma.savedAddress.create({
      data: { userId: req.user.id, label, address, lat: +lat, lng: +lng },
    });
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

router.delete('/me/addresses/:id', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    await prisma.savedAddress.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

'use strict';

const { haversineKm } = require('./geo');
const { sendPushNotifications } = require('./push');
const { notifyAdmins } = require('./notifications');

// ── Config cache ──────────────────────────────────────────────────────────────
// Loaded from DispatchConfig DB table; refreshed at most once every 60 seconds.
// Falls back to env var / hardcoded defaults if the DB is unreachable.
let _cfg = null;
let _cfgFetchedAt = 0;
const CACHE_TTL = 60_000;

// ── Zone cache ────────────────────────────────────────────────────────────────
let _zones = null;
let _zonesFetchedAt = 0;

async function getZones(prisma) {
  const now = Date.now();
  if (_zones && now - _zonesFetchedAt < CACHE_TTL) return _zones;
  try {
    _zones = await prisma.dispatchZone.findMany({ where: { isActive: true } });
    _zonesFetchedAt = now;
  } catch { _zones = []; }
  return _zones;
}

function invalidateZoneCache() { _zones = null; _zonesFetchedAt = 0; }

async function getConfig(prisma) {
  const now = Date.now();
  if (_cfg && now - _cfgFetchedAt < CACHE_TTL) return _cfg;
  try {
    let row = await prisma.dispatchConfig.findFirst();
    if (!row) row = await prisma.dispatchConfig.create({ data: {} });
    _cfg = {
      radiusKm:       row.radiusKm,
      fallbackMs:     row.fallbackSecs * 1000,
      locationFreshMs: row.locationFreshMins * 60 * 1000,
    };
    _cfgFetchedAt = now;
  } catch {
    _cfg = {
      radiusKm:       parseFloat(process.env.DISPATCH_RADIUS_KM ?? '5'),
      fallbackMs:     90_000,
      locationFreshMs: 10 * 60 * 1000,
    };
  }
  return _cfg;
}

function invalidateDispatchCache() {
  _cfg = null;
  _cfgFetchedAt = 0;
}

// ── Timer map ─────────────────────────────────────────────────────────────────
const pendingTimers = new Map();

function buildOffer(order) {
  return {
    orderId:            order.id,
    pickup: {
      address:     order.pickupAddress,
      contactName: order.pickupContactName,
      phone:       order.pickupPhone,
    },
    dropoff: {
      address:       order.dropoffAddress,
      recipientName: order.recipientName,
      phone:         order.recipientPhone,
    },
    payout:             order.estimatedPrice,
    packageSize:        order.packageSize,
    packageDescription: order.packageDescription,
  };
}

async function dispatchOrder(io, prisma, order) {
  const { pickupLat, pickupLng } = order;
  if (pickupLat == null || pickupLng == null) return;

  const cfg = await getConfig(prisma);
  const { fallbackMs, locationFreshMs } = cfg;

  // Zone matching: find the closest active zone whose boundary contains the pickup.
  // Falls back to the global radiusKm if no zone matches.
  const zones = await getZones(prisma);
  let radiusKm = cfg.radiusKm;
  if (zones.length) {
    const matched = zones
      .map(z => ({ z, dist: haversineKm(pickupLat, pickupLng, z.centerLat, z.centerLng) }))
      .filter(({ z, dist }) => dist <= z.zoneBoundaryKm)
      .sort((a, b) => a.dist - b.dist);
    if (matched.length) {
      radiusKm = matched[0].z.dispatchRadiusKm;
      console.log(`[Dispatch] Zone matched: "${matched[0].z.name}" → radius ${radiusKm}km`);
    }
  }

  const latDelta   = radiusKm / 111;
  const lngDelta   = radiusKm / 109;
  const freshSince = new Date(Date.now() - locationFreshMs);

  const candidates = await prisma.rider.findMany({
    where: {
      isApproved:  true,
      isAvailable: true,
      isOnDelivery: false,
      isSuspended: false,
      lastLat: { gte: pickupLat - latDelta, lte: pickupLat + latDelta },
      lastLng: { gte: pickupLng - lngDelta, lte: pickupLng + lngDelta },
      lastLocationAt: { gte: freshSince },
    },
    select: { id: true, lastLat: true, lastLng: true, pushToken: true },
  });

  const nearby = candidates.filter(
    r => haversineKm(pickupLat, pickupLng, r.lastLat, r.lastLng) <= radiusKm
  );

  if (!nearby.length) {
    console.log(`[Dispatch] No riders within ${radiusKm}km for order ${order.id}`);
    await notifyAdmins(prisma, {
      title:   'No nearby riders',
      message: `Order ${order.id.slice(-8).toUpperCase()} — no available riders within ${radiusKm}km. Manual assignment needed.`,
      type:    'order_unassigned',
      orderId: order.id,
    });
    io.to('admin').emit('order:unassigned', { orderId: order.id, reason: 'no_riders' });
    return;
  }

  const baseOffer = buildOffer(order);
  const tokens    = [];

  for (const rider of nearby) {
    const distanceKm = Math.round(haversineKm(pickupLat, pickupLng, rider.lastLat, rider.lastLng) * 10) / 10;
    io.to(`rider:${rider.id}`).emit('order:new', { ...baseOffer, distanceKm });
    if (rider.pushToken) tokens.push(rider.pushToken);
  }

  await sendPushNotifications(tokens, {
    title: 'New delivery offer',
    body:  `${order.pickupAddress} → ${order.dropoffAddress} · GH₵${order.estimatedPrice}`,
    data:  baseOffer,
  });

  console.log(`[Dispatch] Order ${order.id} sent to ${nearby.length} rider(s) within ${radiusKm}km`);
  scheduleAdminFallback(prisma, io, order.id, fallbackMs);
}

function scheduleAdminFallback(prisma, io, orderId, fallbackMs) {
  const handle = setTimeout(async () => {
    pendingTimers.delete(orderId);
    try {
      const order = await prisma.order.findUnique({
        where:  { id: orderId },
        select: { status: true },
      });
      if (!order || order.status !== 'PENDING') return;

      console.log(`[Dispatch] Fallback: order ${orderId} still unaccepted after ${fallbackMs / 1000}s`);
      await notifyAdmins(prisma, {
        title:   'No rider accepted',
        message: `Order ${orderId.slice(-8).toUpperCase()} has no rider after ${fallbackMs / 1000} seconds. Manual assignment required.`,
        type:    'order_unassigned',
        orderId,
      });
      io.to('admin').emit('order:unassigned', { orderId, reason: 'timeout' });
    } catch (err) {
      console.error('[Dispatch] fallback error:', err.message);
    }
  }, fallbackMs);

  pendingTimers.set(orderId, handle);
}

function cancelDispatch(orderId) {
  const handle = pendingTimers.get(orderId);
  if (handle) {
    clearTimeout(handle);
    pendingTimers.delete(orderId);
  }
}

module.exports = { dispatchOrder, cancelDispatch, invalidateDispatchCache, invalidateZoneCache };

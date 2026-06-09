require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');
const jwt     = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const authRoutes          = require('./routes/auth');
const orderRoutes         = require('./routes/orders');
const riderRoutes         = require('./routes/riders');
const adminRoutes         = require('./routes/admin');
const trackRoutes         = require('./routes/tracking');
const notifRoutes         = require('./routes/notifications');
const userRoutes          = require('./routes/users');
const businessRoutes      = require('./routes/business');
const adminBusinessRoutes = require('./routes/admin-business');

const app    = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'starvia-secret';

// ─── CORS origin whitelist ────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

// In development fall back to common localhost ports
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:5174', 'http://localhost:4000');
}

function corsOrigin(origin, callback) {
  // Allow non-browser requests (mobile apps, curl, server-side)
  if (!origin) return callback(null, true);
  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  callback(new Error(`CORS: origin ${origin} not allowed`));
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
});

// Socket.IO JWT authentication middleware — reject unauthenticated connections
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

// Make io & prisma accessible in routes
app.set('io', io);
app.set('prisma', prisma);

// ─── Socket handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const { id: userId, role } = socket.user;
  console.log(`[WS] connected: ${socket.id} (user=${userId} role=${role})`);

  // Rider joins their own room — only if the userId matches a rider record
  socket.on('rider:join', async ({ riderId }) => {
    try {
      const rider = await prisma.rider.findUnique({ where: { id: riderId }, select: { userId: true } });
      if (!rider || rider.userId !== userId) {
        socket.emit('error', 'Unauthorized');
        return;
      }
      socket.join(`rider:${riderId}`);
      console.log(`[WS] rider ${riderId} joined`);
    } catch (err) {
      console.error('[WS] rider:join error', err.message);
    }
  });

  // Customer joins an order room — only if the order belongs to them (or admin)
  socket.on('order:watch', async ({ orderId }) => {
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, riderId: true } });
      if (!order) return;
      const ownsOrder = order.customerId === userId;
      const isAdmin   = role === 'ADMIN';
      // Also allow the assigned rider to watch their own order room
      const riderRec  = role === 'RIDER'
        ? await prisma.rider.findUnique({ where: { userId }, select: { id: true } })
        : null;
      const isAssignedRider = riderRec && order.riderId === riderRec.id;
      if (!ownsOrder && !isAdmin && !isAssignedRider) {
        socket.emit('error', 'Forbidden');
        return;
      }
      socket.join(`order:${orderId}`);
      console.log(`[WS] watching order ${orderId}`);
    } catch (err) {
      console.error('[WS] order:watch error', err.message);
    }
  });

  // Customer joins their own room to receive order status updates
  socket.on('customer:join', () => {
    if (role !== 'CUSTOMER') {
      socket.emit('error', 'Forbidden');
      return;
    }
    socket.join(`customer:${userId}`);
    console.log(`[WS] customer ${userId} joined`);
  });

  // Admin joins global admin room — ADMIN role required
  socket.on('admin:join', () => {
    if (role !== 'ADMIN') {
      socket.emit('error', 'Forbidden');
      return;
    }
    socket.join('admin');
    console.log(`[WS] admin joined`);
  });

  // Rider sends GPS update — validate they own the rider record
  socket.on('rider:location', async ({ riderId, orderId, lat, lng, heading, speed }) => {
    try {
      const rider = await prisma.rider.findUnique({ where: { id: riderId } });
      if (!rider || rider.userId !== userId) return;

      await prisma.riderLocation.create({
        data: { riderId: rider.id, lat, lng, heading, speed },
      });

      await prisma.rider.update({
        where: { id: rider.id },
        data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
      });

      const payload = { riderId: rider.id, orderId, lat, lng, heading, speed, ts: Date.now() };
      if (orderId) io.to(`order:${orderId}`).emit('rider:location', payload);
      io.to('admin').emit('rider:location', payload);
    } catch (err) {
      console.error('[WS] rider:location error', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WS] disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
// Helmet adds Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, etc.
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',           authRoutes);
app.use('/api/v1/orders',         orderRoutes);
app.use('/api/v1/riders',         riderRoutes);
app.use('/api/v1/admin',          adminRoutes);
app.use('/api/v1/admin',          adminBusinessRoutes);
app.use('/api/v1/tracking',       trackRoutes);
app.use('/api/v1/notifications',  notifRoutes);
app.use('/api/v1/users',          userRoutes);
app.use('/api/v1/business',       businessRoutes);

app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── Error handler ────────────────────────────────────────────────────────────
// Only expose the error message for client errors (4xx). For server errors (5xx),
// return a generic message so internal details never reach the client.
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Internal server error';
  res.status(status).json({ error: message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Starvia API running on http://localhost:${PORT}`);
  console.log(`   LAN access: use your PC IP, e.g. http://192.168.x.x:${PORT}`);
  console.log(`   Socket.IO ready (authenticated)`);
  console.log(`   DB: ${process.env.DATABASE_URL?.split('@')[1] || 'connected'}`);
  console.log(`   CORS origins: ${ALLOWED_ORIGINS.join(', ')}\n`);

  // Orphan recovery on startup
  prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 90_000) } },
    select: { id: true },
  }).then(orphans => {
    if (!orphans.length) return;
    console.log(`[Dispatch] ${orphans.length} orphaned PENDING order(s) found`);
    for (const o of orphans) {
      io.to('admin').emit('order:unassigned', { orderId: o.id, reason: 'orphan' });
    }
  }).catch(() => {});
});

module.exports = { app, io };

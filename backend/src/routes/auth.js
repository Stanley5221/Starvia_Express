const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require('../lib/email');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests from this IP, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

const JWT_SECRET  = process.env.JWT_SECRET || 'starvia-secret';
const JWT_EXPIRES = '7d';

/**
 * Sign a JWT token.
 * Includes accountType, businessId, and mustChangePassword so the frontend
 * can quickly identify users and gate the password-change flow without a DB round-trip.
 */
function signToken(user, businessId = null) {
  return jwt.sign(
    {
      id:                 user.id,
      email:              user.email,
      role:               user.role,
      name:               user.name,
      accountType:        user.accountType,
      businessId:         businessId,
      mustChangePassword: user.mustChangePassword ?? false,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ── POST /api/v1/auth/register ─────────────────────────────────────────────

router.post('/register', authLimiter, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { accountType = 'INDIVIDUAL' } = req.body;

    // ── Individual Registration ──────────────────────────────────────────
    if (accountType === 'INDIVIDUAL') {
      const { name, email, phone, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email and password are required' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // Only CUSTOMER self-registration.
      // RIDER accounts are created exclusively by admins (closed fleet model).
      // ADMIN accounts must be seeded manually.
      if (role === 'RIDER') {
        return res.status(403).json({
          error: 'Rider accounts cannot be created through public registration. Please contact Starvia Express to be onboarded as a rider.',
        });
      }
      const allowedRole = 'CUSTOMER';

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { name, email, phone, passwordHash, role: allowedRole, accountType: 'INDIVIDUAL' },
      });

      const token = signToken(user, null);
      // Non-blocking welcome email
      sendWelcomeEmail({ to: user.email, name: user.name }).catch(() => {});
      return res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, accountType: user.accountType },
      });
    }

    // ── Business Registration ────────────────────────────────────────────
    if (accountType === 'BUSINESS') {
      const {
        businessName,
        businessType,
        ownerFullName,
        email,
        phone,
        businessAddress,
        gpsAddress,
        password,
      } = req.body;

      // Validate required fields
      const missing = [];
      if (!businessName)    missing.push('businessName');
      if (!businessType)    missing.push('businessType');
      if (!ownerFullName)   missing.push('ownerFullName');
      if (!email)           missing.push('email');
      if (!phone)           missing.push('phone');
      if (!businessAddress) missing.push('businessAddress');
      if (!password)        missing.push('password');
      if (missing.length) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }

      // Field-level validation
      const validBusinessTypes = ['RESTAURANT', 'PHARMACY', 'SUPERMARKET', 'ONLINE_SHOP', 'CORPORATE', 'OTHER'];
      if (!validBusinessTypes.includes(businessType)) {
        return res.status(400).json({ error: `businessType must be one of: ${validBusinessTypes.join(', ')}` });
      }
      if (businessName.trim().length < 2 || businessName.trim().length > 100) {
        return res.status(400).json({ error: 'businessName must be between 2 and 100 characters' });
      }
      if (ownerFullName.trim().length < 2) {
        return res.status(400).json({ error: 'ownerFullName must be at least 2 characters' });
      }
      if (phone.replace(/\D/g, '').length < 10) {
        return res.status(400).json({ error: 'phone must be at least 10 digits' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // Check email uniqueness in both User and Business tables
      const [existingUser, existingBusiness] = await Promise.all([
        prisma.user.findUnique({ where: { email } }),
        prisma.business.findUnique({ where: { email } }),
      ]);
      if (existingUser)     return res.status(409).json({ error: 'Email already registered' });
      if (existingBusiness) return res.status(409).json({ error: 'A business with this email already exists' });

      const passwordHash = await bcrypt.hash(password, 10);

      // Atomic transaction: create User + Business together
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name:         ownerFullName,
            email,
            phone,
            passwordHash,
            role:         'CUSTOMER',
            accountType:  'BUSINESS',
          },
        });

        const business = await tx.business.create({
          data: {
            ownerId:        user.id,
            businessName:   businessName.trim(),
            businessType,
            ownerFullName:  ownerFullName.trim(),
            phone,
            email,
            businessAddress: businessAddress.trim(),
            gpsAddress:     gpsAddress?.trim() || null,
            verificationStatus: 'PENDING',
          },
        });

        return { user, business };
      });

      const token = signToken(result.user, result.business.id);
      sendWelcomeEmail({ to: result.user.email, name: result.user.name }).catch(() => {});
      return res.status(201).json({
        token,
        user: {
          id:          result.user.id,
          name:        result.user.name,
          email:       result.user.email,
          role:        result.user.role,
          accountType: result.user.accountType,
        },
        business: {
          id:                 result.business.id,
          businessName:       result.business.businessName,
          verificationStatus: result.business.verificationStatus,
        },
      });
    }

    return res.status(400).json({ error: 'accountType must be INDIVIDUAL or BUSINESS' });

  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/login ────────────────────────────────────────────────

router.post('/login', authLimiter, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        business: { select: { id: true, businessName: true, verificationStatus: true } },
        rider:    { select: { isSuspended: true } },
      },
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.isSuspended) {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }
    if (user.role === 'RIDER' && user.rider?.isSuspended) {
      return res.status(403).json({ error: 'Your rider account has been suspended. Please contact support.' });
    }

    const businessId = user.business?.id || null;
    const token = signToken(user, businessId);

    res.json({
      token,
      user: {
        id:                 user.id,
        name:               user.name,
        email:              user.email,
        role:               user.role,
        accountType:        user.accountType,
        mustChangePassword: user.mustChangePassword ?? false,
      },
      // Only included for business accounts so the frontend can redirect correctly
      ...(user.accountType === 'BUSINESS' && {
        business: {
          id:                 user.business.id,
          businessName:       user.business.businessName,
          verificationStatus: user.business.verificationStatus,
        },
      }),
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/auth/me ────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id:          true,
        name:        true,
        email:       true,
        phone:       true,
        role:        true,
        accountType: true,
        createdAt:   true,
        business: {
          select: {
            id:                 true,
            businessName:       true,
            verificationStatus: true,
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/forgot-password ─────────────────────────────────────────
// Always returns 200 so enumeration isn't possible — user never knows if email exists.
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: token, passwordResetExpires: expires },
      });

      const baseUrl  = process.env.CLIENT_URL || 'http://localhost:5173';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch(() => {});
    }

    res.json({ message: 'If that email is registered you will receive a reset link shortly.' });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/reset-password ──────────────────────────────────────────
router.post('/reset-password', authLimiter, async (req, res, next) => {
  const prisma = req.app.get('prisma');
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken:   token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken:   null,
        passwordResetExpires: null,
        mustChangePassword:   false,
      },
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) { next(err); }
});

module.exports = router;

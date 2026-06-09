const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'starvia-secret';

/**
 * Attach decoded user to req.user if token is valid.
 * Token payload includes: id, email, role, name, accountType, businessId
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Allow only specific roles after authenticate().
 * Usage: authorize('ADMIN') or authorize('ADMIN', 'RIDER')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/**
 * Require the user's accountType to be BUSINESS.
 * Use after authenticate().
 */
function requireBusiness(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  if (req.user.accountType !== 'BUSINESS') {
    return res.status(403).json({ error: 'Business account required' });
  }
  next();
}

/**
 * Require the business account to be APPROVED before placing orders or
 * accessing sensitive business data.
 * Use after authenticate() + requireBusiness().
 */
async function requireApproved(req, res, next) {
  const prisma = req.app.get('prisma');
  try {
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user.id },
      select: { verificationStatus: true, isActive: true },
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
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Block access if the rider has a temporary admin-provisioned password and
 * has not yet set their own password.
 * Use after authenticate() on all rider-protected routes.
 * The rider app intercepts the 403 'must_change_password' error code and
 * routes them to the ChangePasswordScreen automatically.
 */
function requirePasswordChanged(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  if (req.user.mustChangePassword) {
    return res.status(403).json({ error: 'must_change_password' });
  }
  next();
}

/**
 * Optional authentication: Decodes user token if provided, but does not reject if missing or invalid.
 */
function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Ignore invalid or expired tokens, proceed as anonymous
    }
  }
  next();
}

/** Alias matching the master prompt naming */
const requireRole = authorize;

module.exports = { authenticate, authorize, requireRole, requireBusiness, requireApproved, requirePasswordChanged, optionalAuthenticate };

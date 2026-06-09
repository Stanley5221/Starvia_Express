export const colors = {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  bg:           '#0c0406',
  surface:      '#160810',
  card:         '#1e0c14',
  cardElevated: '#271019',
  overlay:      'rgba(0,0,0,0.65)',

  // ── Brand ────────────────────────────────────────────────────────────────────
  primary:      '#8B053C',
  primaryDark:  '#6b0430',
  primaryLight: '#b5064f',
  accent:       '#F5A623',
  accentLight:  '#fbbf24',

  // ── Status ───────────────────────────────────────────────────────────────────
  success:  '#10B981',
  warning:  '#F59E0B',
  danger:   '#EF4444',
  info:     '#3B82F6',
  purple:   '#7C3AED',

  // ── Text ─────────────────────────────────────────────────────────────────────
  text:          '#F2E8EC',
  textSecondary: '#C4A0B0',
  muted:         '#7A5060',
  placeholder:   '#4A3040',

  // ── UI ───────────────────────────────────────────────────────────────────────
  border:      'rgba(139,5,60,0.22)',
  borderLight: 'rgba(255,255,255,0.07)',
  white:       '#FFFFFF',
  black:       '#000000',
};

export const STATUS_COLORS = {
  PENDING:    colors.muted,
  ACCEPTED:   colors.accent,
  PICKED_UP:  colors.purple,
  IN_TRANSIT: colors.info,
  ARRIVED:    colors.warning,
  DELIVERED:  colors.success,
  CANCELLED:  colors.danger,
};

export const STATUS_LABELS = {
  PENDING:    'Finding Rider',
  ACCEPTED:   'Accepted',
  PICKED_UP:  'Picked Up',
  IN_TRANSIT: 'In Transit',
  ARRIVED:    'Arrived',
  DELIVERED:  'Delivered',
  CANCELLED:  'Cancelled',
};

export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  full: 999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  brand: {
    shadowColor: '#8B053C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

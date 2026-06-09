export const darkColors = {
  bg:           '#0c0406',
  surface:      '#160810',
  card:         '#1e0c14',
  cardElevated: '#271019',
  overlay:      'rgba(0,0,0,0.65)',

  primary:      '#8B053C',
  primaryDark:  '#6b0430',
  primaryLight: '#b5064f',
  accent:       '#F5A623',
  accentLight:  '#fbbf24',

  success:  '#10B981',
  warning:  '#F59E0B',
  danger:   '#EF4444',
  info:     '#3B82F6',
  purple:   '#7C3AED',

  text:          '#F2E8EC',
  textSecondary: '#C4A0B0',
  muted:         '#7A5060',
  placeholder:   '#4A3040',

  border:      'rgba(139,5,60,0.22)',
  borderLight: 'rgba(255,255,255,0.07)',
  white:       '#FFFFFF',
  black:       '#000000',
};

export const lightColors = {
  bg:           '#FFF5F7',
  surface:      '#FFFFFF',
  card:         '#FFFFFF',
  cardElevated: '#FFF0F4',
  overlay:      'rgba(0,0,0,0.45)',

  primary:      '#8B053C',
  primaryDark:  '#6b0430',
  primaryLight: '#b5064f',
  accent:       '#F5A623',
  accentLight:  '#fbbf24',

  success:  '#10B981',
  warning:  '#F59E0B',
  danger:   '#EF4444',
  info:     '#3B82F6',
  purple:   '#7C3AED',

  text:          '#1A0810',
  textSecondary: '#4A1525',
  muted:         '#9E6070',
  placeholder:   '#C4A0B0',

  border:      'rgba(139,5,60,0.18)',
  borderLight: 'rgba(139,5,60,0.08)',
  white:       '#FFFFFF',
  black:       '#000000',
};

// Backward-compat alias
export const colors = darkColors;

export const STATUS_COLORS = {
  PENDING:    darkColors.muted,
  ACCEPTED:   darkColors.accent,
  PICKED_UP:  darkColors.purple,
  IN_TRANSIT: darkColors.info,
  ARRIVED:    darkColors.warning,
  DELIVERED:  darkColors.success,
  CANCELLED:  darkColors.danger,
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

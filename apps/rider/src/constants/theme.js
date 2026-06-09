export const darkColors = {
  bg:           '#0c0406',
  bgDark:       '#080204',
  card:         '#160810',
  surface:      '#1e0d14',

  primary:      '#8B053C',
  primaryDark:  '#6b0430',
  primaryLight: '#b5064f',

  accent:  '#F5A623',
  amber:   '#F5A623',

  text:          '#F2E8EC',
  textSecondary: '#E8D5DC',
  muted:         '#9E8891',
  placeholder:   '#6B5560',
  white:         '#FFFFFF',

  success: '#10B981',
  danger:  '#EF4444',
  warning: '#F59E0B',

  border:      'rgba(139,5,60,0.22)',
  borderLight: 'rgba(255,255,255,0.08)',
};

export const lightColors = {
  bg:           '#FFF5F7',
  bgDark:       '#FCE8EF',
  card:         '#FFFFFF',
  surface:      '#FFF0F4',

  primary:      '#8B053C',
  primaryDark:  '#6b0430',
  primaryLight: '#b5064f',

  accent:  '#F5A623',
  amber:   '#F5A623',

  text:          '#1A0810',
  textSecondary: '#4A1525',
  muted:         '#9E6070',
  placeholder:   '#C4A0B0',
  white:         '#FFFFFF',

  success: '#10B981',
  danger:  '#EF4444',
  warning: '#F59E0B',

  border:      'rgba(139,5,60,0.18)',
  borderLight: 'rgba(139,5,60,0.08)',
};

// Backward-compat alias — screens that haven't migrated yet still get dark theme
export const colors = darkColors;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const shadow = {
  sm:    { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,  elevation: 3 },
  md:    { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2,  shadowRadius: 8,  elevation: 5 },
  brand: { shadowColor: '#8B053C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
};

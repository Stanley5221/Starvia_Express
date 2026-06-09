import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STATUS_COLORS, STATUS_LABELS } from '../constants/theme';

const STATUS_ICONS = {
  PENDING:    'time-outline',
  ACCEPTED:   'checkmark-circle-outline',
  PICKED_UP:  'cube-outline',
  IN_TRANSIT: 'bicycle-outline',
  ARRIVED:    'location-outline',
  DELIVERED:  'checkmark-done-circle',
  CANCELLED:  'close-circle-outline',
};

export default function StatusBadge({ status, size = 'md' }) {
  const color = STATUS_COLORS[status] || '#9CA3AF';
  const label = STATUS_LABELS[status] || status;
  const icon  = STATUS_ICONS[status]  || 'ellipse-outline';
  const small = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: color + '22', borderColor: color + '44' },
      small && styles.badgeSm,
    ]}>
      <Ionicons name={icon} size={small ? 10 : 12} color={color} />
      <Text style={[styles.text, { color }, small && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 9,
  },
});

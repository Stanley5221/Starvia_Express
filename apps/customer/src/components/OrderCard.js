import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../constants/theme';
import { formatMoney } from '../constants/currency';
import StatusBadge from './StatusBadge';

export default function OrderCard({ order, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, friction: 8 }).start();

  const date = new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={[styles.card, shadow.sm]}
      >
        {/* Left icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="cube" size={20} color={colors.primary} />
        </View>

        {/* Main content */}
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
            <StatusBadge status={order.status} size="sm" />
          </View>
          <Text style={styles.recipient} numberOfLines={1}>
            To: {order.recipientName}
          </Text>
          <View style={styles.bottomRow}>
            <View style={styles.routeWrap}>
              <Ionicons name="navigate" size={10} color={colors.purple} />
              <Text style={styles.routeText} numberOfLines={1}>
                {order.pickupAddress?.split(',')[0]}
              </Text>
              <Ionicons name="arrow-forward" size={10} color={colors.muted} />
              <Ionicons name="location" size={10} color={colors.accent} />
              <Text style={styles.routeText} numberOfLines={1}>
                {order.dropoffAddress?.split(',')[0]}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={10} color={colors.muted} />
            <Text style={styles.metaText}>{date}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.price}>
              {formatMoney(order.finalPrice ?? order.estimatedPrice)}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '18',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderId: { fontFamily: 'monospace', fontSize: 12, color: colors.muted, fontWeight: '700' },
  recipient: { fontSize: 14, fontWeight: '700', color: colors.text },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  routeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  routeText: { fontSize: 11, color: colors.textSecondary, flexShrink: 1, maxWidth: 80 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 10, color: colors.muted },
  dot: { fontSize: 10, color: colors.muted },
  price: { fontSize: 11, fontWeight: '800', color: colors.accent },
});

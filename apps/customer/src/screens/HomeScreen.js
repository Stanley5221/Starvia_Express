import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Animated, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { connectSocket } from '../lib/socket';
import api from '../lib/api';
import { radius, shadow } from '../constants/theme';
import { formatMoney, formatMoneyCompact } from '../constants/currency';
import OrderCard from '../components/OrderCard';
import StatusBadge from '../components/StatusBadge';

const { width } = Dimensions.get('window');

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function ActiveOrderBanner({ order, onTrack }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <TouchableOpacity onPress={onTrack} activeOpacity={0.85}>
      <Animated.View style={[styles.activeBanner, { transform: [{ scale: pulse }] }]}>
        <LinearGradient
          colors={[colors.primary + '30', colors.primaryDark + '60']}
          style={styles.activeBannerGrad}
        >
          <View style={styles.activeDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>Active Delivery</Text>
            <Text style={styles.activeBannerSub} numberOfLines={1}>
              To {order.recipientName} · {order.dropoffAddress?.split(',')[0]}
            </Text>
          </View>
          <StatusBadge status={order.status} size="sm" />
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

function StatCard({ icon, iconColor, label, value }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'];

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const [orders, setOrders]       = useState([]);
  const [stats, setStats]         = useState({ total: 0, delivered: 0, spent: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const activeOrder = orders.find(o => ACTIVE_STATUSES.includes(o.status));
  const recent      = orders.slice(0, 5);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
      const delivered = data.filter(o => o.status === 'DELIVERED');
      setStats({
        total:     data.length,
        delivered: delivered.length,
        spent:     delivered.reduce((s, o) => s + (o.finalPrice ?? o.estimatedPrice ?? 0), 0),
      });
    } catch (_) {}
  }, []);

  useEffect(() => {
    load();
    let _socket = null;
    connectSocket().then(socket => {
      _socket = socket;
      socket.on('order:status_changed', load);
      socket.on('order:assigned', load);
    }).catch(() => {});
    return () => {
      if (_socket) {
        _socket.off('order:status_changed', load);
        _socket.off('order:assigned', load);
      }
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={[colors.primary + '35', colors.surface, colors.bg]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greetText}>{greeting()},</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0]} 👋</Text>
            </View>
            <TouchableOpacity style={styles.avatarBtn}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Send Package CTA */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Send')}
            activeOpacity={0.88}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.ctaBtn}
            >
              <Ionicons name="cube" size={22} color={colors.white} />
              <Text style={styles.ctaText}>Send a Package</Text>
              <Ionicons name="arrow-forward-circle" size={22} color={colors.white} style={{ marginLeft: 'auto' }} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Quick actions row */}
          <View style={styles.quickRow}>
            {[
              { icon: 'time-outline',   label: 'Track',    onPress: () => navigation.navigate('Orders') },
              { icon: 'receipt-outline', label: 'History',  onPress: () => navigation.navigate('Orders') },
              { icon: 'person-outline', label: 'Profile',  onPress: () => navigation.navigate('Profile') },
            ].map(q => (
              <TouchableOpacity key={q.label} onPress={q.onPress} style={styles.quickBtn} activeOpacity={0.7}>
                <View style={styles.quickIcon}>
                  <Ionicons name={q.icon} size={20} color={colors.accent} />
                </View>
                <Text style={styles.quickLabel}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Active order banner */}
          {activeOrder && (
            <ActiveOrderBanner
              order={activeOrder}
              onTrack={() => navigation.navigate('TrackOrder', { orderId: activeOrder.id })}
            />
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard icon="cube-outline"            iconColor={colors.primary} label="Total Orders" value={stats.total} />
            <StatCard icon="checkmark-done-circle"   iconColor={colors.success} label="Delivered"    value={stats.delivered} />
            <StatCard icon="wallet-outline"          iconColor={colors.accent}  label="Total Spent"  value={formatMoneyCompact(stats.spent)} />
          </View>

          {/* Recent orders */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptyBody}>Tap "Send a Package" to place your first delivery</Text>
            </View>
          ) : (
            recent.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => navigation.navigate('TrackOrder', { orderId: order.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const STAT_W = (width - 48 - 16) / 3;

const createStyles = (colors) => StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greetText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  userName:  { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 2 },
  avatarBtn: {},
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.brand,
  },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: colors.white },

  ctaWrap: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, ...shadow.brand },
  ctaBtn:  { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.white, flex: 1 },

  quickRow: { flexDirection: 'row', gap: 12 },
  quickBtn:  { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: {
    width: 50, height: 50, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  body: { paddingHorizontal: 20, paddingTop: 20 },

  activeBanner:     { marginBottom: 16, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.primary + '40' },
  activeBannerGrad: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  activeDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  activeBannerTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  activeBannerSub:   { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    width: STAT_W,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, alignItems: 'center', gap: 6,
  },
  statIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 17, fontWeight: '800', color: colors.text },
  seeAll:        { fontSize: 13, fontWeight: '700', color: colors.accent },

  emptyWrap:  { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  emptyBody:  { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});

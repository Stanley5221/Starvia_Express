import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Animated, RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useActiveOrder } from '../context/ActiveOrderContext';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../constants/theme';
import { formatGHSFull } from '../constants/currency';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const OFFER_SECONDS = 30;

function PulseRing({ color, size = 80 }) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(val, { toValue: 1, duration: 2000, useNativeDriver: true }),
          ]),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 700);
    a1.start(); a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, []);

  const ringStyle = (val) => ({
    position: 'absolute',
    width: size, height: size, borderRadius: size / 2,
    borderWidth: 2, borderColor: resolvedColor,
    opacity: val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size * 0.225, backgroundColor: resolvedColor + '25', borderColor: resolvedColor, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 }}>
        <Ionicons name="radio" size={20} color={resolvedColor} />
      </View>
    </View>
  );
}

function ActiveBanner({ order, onPress }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.02, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  const labels = { ACCEPTED: 'Heading to pickup', PICKED_UP: 'Package collected', IN_TRANSIT: 'En route to drop-off', ARRIVED: 'At destination' };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ marginBottom: 16 }}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <LinearGradient colors={[colors.success + '25', colors.success + '10']} style={styles.activeBanner}>
          <View style={styles.activeDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>{labels[order.status] || 'Active Delivery'}</Text>
            <Text style={styles.activeBannerSub} numberOfLines={1}>
              To {order.recipientName} · {order.dropoffAddress?.split(',')[0]}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { rider, refreshProfile } = useAuth();
  const { incomingOffer, acceptOrder, rejectOrder, setIncomingOffer, activeOrder } = useActiveOrder();

  const [isAvailable, setIsAvailable] = useState(false);
  const [summary, setSummary]         = useState(null);
  const [countdown, setCountdown]     = useState(0);
  const [busy, setBusy]               = useState(false);
  const [refreshing, setRefreshing]   = useState(false);

  useEffect(() => { if (rider) setIsAvailable(rider.isAvailable); }, [rider]);
  useEffect(() => { loadSummary(); }, [rider]);

  useEffect(() => {
    if (!incomingOffer) { setCountdown(0); return; }
    const elapsed = Math.floor((Date.now() - (incomingOffer.receivedAt || Date.now())) / 1000);
    setCountdown(Math.max(0, OFFER_SECONDS - elapsed));
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { setIncomingOffer(null); return 0; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [incomingOffer]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.orderId && !incomingOffer) setIncomingOffer({ ...data, receivedAt: Date.now() });
    });
    return () => sub.remove();
  }, [incomingOffer, setIncomingOffer]);

  async function loadSummary() {
    try { const { data } = await api.get('/riders/earnings/summary'); setSummary(data); } catch (_) {}
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), loadSummary()]);
    setRefreshing(false);
  }, []);

  async function toggleAvailable() {
    const next = !isAvailable;
    try {
      await api.patch('/riders/availability', { isAvailable: next });
      setIsAvailable(next);
      await refreshProfile();
    } catch {
      Alert.alert('Error', 'Could not update availability');
    }
  }

  async function handleAccept() {
    if (!incomingOffer?.orderId) return;
    setBusy(true);
    try {
      await acceptOrder(incomingOffer.orderId);
      navigation.navigate('Active');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not accept order');
    } finally { setBusy(false); }
  }

  async function handleReject() {
    if (!incomingOffer?.orderId) return;
    try { await rejectOrder(incomingOffer.orderId); } catch (_) { setIncomingOffer(null); }
  }

  const initials = rider?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'RD';
  const riderId  = rider?.riderId || `RD-${rider?.id?.slice(-5)?.toUpperCase() || '-----'}`;
  const urgencyColor = countdown <= 10 ? colors.danger : countdown <= 20 ? colors.warning : colors.accent;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={[colors.primary + '30', colors.surface, colors.bg]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.greeting}>Hello, {rider?.fullName?.split(' ')[0] || 'Rider'} 👋</Text>
              <Text style={styles.riderId}>{riderId}</Text>
            </View>
            <View style={styles.statusPill(isAvailable)}>
              <View style={styles.statusDot(isAvailable)} />
              <Text style={styles.statusText(isAvailable)}>{isAvailable ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          {/* Availability toggle */}
          <View style={styles.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{isAvailable ? "You're Online" : "You're Offline"}</Text>
              <Text style={styles.toggleSub}>
                {isAvailable ? 'Ready to receive delivery offers' : 'Toggle on to start receiving orders'}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailable}
              trackColor={{ false: colors.surface, true: colors.success + '60' }}
              thumbColor={isAvailable ? colors.success : colors.muted}
            />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Active delivery banner */}
          {activeOrder && !incomingOffer && (
            <ActiveBanner order={activeOrder} onPress={() => navigation.navigate('Active')} />
          )}

          {/* ── Earnings card ── */}
          <LinearGradient
            colors={[colors.primaryLight + '40', colors.primary + '20', colors.card]}
            style={styles.earningsCard}
          >
            <View style={styles.earningsHeader}>
              <Ionicons name="wallet" size={18} color={colors.accent} />
              <Text style={styles.earningsTitle}>Earnings Overview</Text>
            </View>
            <View style={styles.earningsRow}>
              <View style={styles.earningsCol}>
                <Text style={styles.earningsLabel}>Today</Text>
                <Text style={styles.earningsAmount}>{formatGHSFull(summary?.today?.earnings ?? 0)}</Text>
                <Text style={styles.earningsSub}>{summary?.today?.deliveries ?? 0} {summary?.today?.deliveries === 1 ? 'delivery' : 'deliveries'}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsCol}>
                <Text style={styles.earningsLabel}>This week</Text>
                <Text style={styles.earningsAmount}>{formatGHSFull(summary?.week?.earnings ?? 0)}</Text>
                <Text style={styles.earningsSub}>{summary?.week?.deliveries ?? 0} {summary?.week?.deliveries === 1 ? 'delivery' : 'deliveries'}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsCol}>
                <Text style={styles.earningsLabel}>This month</Text>
                <Text style={styles.earningsAmount}>{formatGHSFull(summary?.month?.earnings ?? 0)}</Text>
                <Text style={styles.earningsSub}>{summary?.month?.deliveries ?? 0} deliveries</Text>
              </View>
            </View>
          </LinearGradient>

          {/* ── Quick stats ── */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="star" size={18} color={colors.warning} />
              <Text style={styles.statValue}>{rider?.averageRating?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cube" size={18} color={colors.accent} />
              <Text style={styles.statValue}>{rider?.totalDeliveries ?? 0}</Text>
              <Text style={styles.statLabel}>Deliveries</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cash" size={18} color={colors.success} />
              <Text style={styles.statValue}>{formatGHSFull(rider?.totalEarnings ?? 0)}</Text>
              <Text style={styles.statLabel}>Total earned</Text>
            </View>
          </View>

          {/* ── Incoming offer ── */}
          {incomingOffer ? (
            <View style={styles.offerCard}>
              {/* Countdown bar */}
              <View style={styles.offerTopRow}>
                <View>
                  <Text style={styles.offerIdText}>#{incomingOffer.orderId?.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.offerDist}>{incomingOffer.distanceKm ?? '—'} km from you</Text>
                </View>
                <View style={[styles.countdownBadge, { borderColor: urgencyColor }]}>
                  <Ionicons name="timer-outline" size={14} color={urgencyColor} />
                  <Text style={[styles.countdownText, { color: urgencyColor }]}>{countdown}s</Text>
                </View>
              </View>

              {/* Route */}
              <View style={styles.routeBlock}>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeMain}>{incomingOffer.pickup?.address}</Text>
                    <Text style={styles.routeSub}>{incomingOffer.pickup?.contactName} · {incomingOffer.pickup?.phone}</Text>
                  </View>
                </View>
                <View style={styles.routeConnector} />
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeMain}>{incomingOffer.dropoff?.address}</Text>
                    <Text style={styles.routeSub}>{incomingOffer.dropoff?.recipientName}</Text>
                  </View>
                </View>
              </View>

              {/* Package */}
              <View style={styles.packageRow}>
                <Ionicons name="cube-outline" size={14} color={colors.muted} />
                <Text style={styles.packageText}>
                  {incomingOffer.packageSize || 'Standard'} · {incomingOffer.packageDescription || 'Package'}
                </Text>
              </View>

              {/* Footer */}
              <View style={styles.offerFooter}>
                <Text style={styles.offerPayout}>{formatGHSFull(incomingOffer.payout)}</Text>
                <View style={styles.offerActions}>
                  <TouchableOpacity onPress={handleReject} style={styles.rejectBtn}>
                    <Ionicons name="close" size={16} color={colors.danger} />
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAccept} disabled={busy} style={styles.acceptBtnWrap}>
                    <LinearGradient colors={[colors.success, '#059669']} style={styles.acceptBtn}>
                      {busy
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <>
                            <Ionicons name="checkmark" size={16} color={colors.white} />
                            <Text style={styles.acceptText}>Accept</Text>
                          </>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : isAvailable ? (
            /* ── Waiting state ── */
            <View style={styles.waitingCard}>
              <PulseRing color={colors.success} size={80} />
              <Text style={styles.waitingTitle}>Searching for orders</Text>
              <Text style={styles.waitingSub}>You'll be notified when a delivery is nearby</Text>
            </View>
          ) : (
            /* ── Offline state ── */
            <View style={styles.offlineCard}>
              <View style={styles.offlineIcon}>
                <Ionicons name="power" size={28} color={colors.muted} />
              </View>
              <Text style={styles.offlineTitle}>You're Offline</Text>
              <Text style={styles.offlineSub}>Toggle online above to start receiving delivery offers in your area.</Text>
              <TouchableOpacity onPress={toggleAvailable} style={styles.goOnlineBtnWrap}>
                <LinearGradient colors={[colors.primaryLight, colors.primaryDark]} style={styles.goOnlineBtn}>
                  <Ionicons name="power" size={16} color={colors.white} />
                  <Text style={styles.goOnlineText}>Go Online</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },

  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 16 },

  greeting: { color: colors.text, fontSize: 16, fontWeight: '700' },
  riderId:  { color: colors.muted, fontSize: 11, marginTop: 2 },

  statusPill: (on) => ({
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: on ? colors.success + '20' : colors.surface,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: on ? colors.success + '40' : colors.borderLight,
  }),
  statusDot: (on) => ({
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: on ? colors.success : colors.muted,
  }),
  statusText: (on) => ({ fontSize: 11, fontWeight: '700', color: on ? colors.success : colors.muted }),

  toggleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, gap: 12,
  },
  toggleLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  toggleSub:   { fontSize: 12, color: colors.muted, marginTop: 2 },

  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Active banner
  activeBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.success + '30' },
  activeDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  activeBannerTitle: { fontSize: 14, fontWeight: '800', color: colors.success },
  activeBannerSub:   { fontSize: 12, color: colors.muted, marginTop: 2 },

  // Earnings card
  earningsCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 16, ...shadow.md },
  earningsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  earningsTitle:  { fontSize: 13, fontWeight: '700', color: colors.accent },
  earningsRow:    { flexDirection: 'row', alignItems: 'center' },
  earningsCol:    { flex: 1, alignItems: 'center' },
  earningsDivider: { width: 1, height: 40, backgroundColor: colors.borderLight },
  earningsLabel:  { fontSize: 11, color: colors.muted, marginBottom: 4 },
  earningsAmount: { fontSize: 17, fontWeight: '800', color: colors.accent },
  earningsSub:    { fontSize: 10, color: colors.muted, marginTop: 3 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.muted },

  // Offer card
  offerCard: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primary + '50', padding: 16, marginBottom: 16, ...shadow.brand },
  offerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  offerIdText: { fontSize: 13, fontWeight: '800', color: colors.text },
  offerDist:   { fontSize: 11, color: colors.muted, marginTop: 2 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countdownText:  { fontSize: 13, fontWeight: '800' },

  routeBlock:     { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  routeRow:       { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  routeDot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeMain:      { color: colors.text, fontWeight: '700', fontSize: 14 },
  routeSub:       { color: colors.muted, fontSize: 11, marginTop: 2 },
  routeConnector: { width: 2, height: 14, backgroundColor: colors.borderLight, marginLeft: 4, marginVertical: 4 },

  packageRow:  { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 14 },
  packageText: { color: colors.muted, fontSize: 12 },

  offerFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  offerPayout:  { fontSize: 24, fontWeight: '900', color: colors.accent },
  offerActions: { flexDirection: 'row', gap: 10 },
  rejectBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + '40', backgroundColor: colors.danger + '12' },
  rejectText:   { color: colors.danger, fontWeight: '700', fontSize: 13 },
  acceptBtnWrap: { borderRadius: radius.md, overflow: 'hidden' },
  acceptBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10 },
  acceptText:   { color: colors.white, fontWeight: '800', fontSize: 14 },

  // Waiting state
  waitingCard: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.success + '30', padding: 32, alignItems: 'center', gap: 14, marginBottom: 16 },
  waitingTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  waitingSub:   { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  // Offline state
  offlineCard: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 32, alignItems: 'center', gap: 12, marginBottom: 16 },
  offlineIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight },
  offlineTitle: { fontSize: 18, fontWeight: '800', color: colors.textSecondary },
  offlineSub:   { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  goOnlineBtnWrap: { borderRadius: radius.md, overflow: 'hidden', marginTop: 4, ...shadow.brand },
  goOnlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  goOnlineText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});

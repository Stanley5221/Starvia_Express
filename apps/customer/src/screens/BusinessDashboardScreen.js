import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow, STATUS_COLORS } from '../constants/theme';
import { formatMoney } from '../constants/currency';

function StatCard({ icon, label, value, color, colors, styles }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: (color ?? colors.primary) + '20' }]}>
        <Ionicons name={icon} size={20} color={color ?? colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function BusinessDashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const STATUS_CONFIG = {
    PENDING:      { color: colors.warning,  icon: 'time-outline',             text: 'Application pending — upload your documents to get verified.' },
    UNDER_REVIEW: { color: colors.info,     icon: 'search-outline',           text: 'Documents under review. This takes 1–2 business days.' },
    APPROVED:     { color: colors.success,  icon: 'checkmark-circle-outline', text: 'Account approved! You have access to business pricing.' },
    REJECTED:     { color: colors.danger,   icon: 'close-circle-outline',     text: 'Verification rejected. Please re-upload your documents.' },
    SUSPENDED:    { color: colors.danger,   icon: 'ban-outline',              text: 'Account suspended. Contact support for assistance.' },
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/business/dashboard');
      setData(res.data);
      await refreshUser();
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const biz     = data?.business ?? user?.business;
  const stats   = data?.stats ?? {};
  const pricing = data?.pricing;
  const recent  = data?.recentOrders ?? [];
  const verStatus = biz?.verificationStatus ?? 'PENDING';
  const cfg       = STATUS_CONFIG[verStatus] ?? STATUS_CONFIG.PENDING;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboard(); }} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{biz?.businessName ?? 'Business Dashboard'}</Text>
          <Text style={styles.headerSub}>{biz?.businessType?.replace(/_/g, ' ')}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16, gap: 14 }}>
        {/* Verification banner */}
        <View style={[styles.verBanner, { borderColor: cfg.color + '50', backgroundColor: cfg.color + '10' }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.verStatus, { color: cfg.color }]}>{verStatus.replace(/_/g, ' ')}</Text>
            <Text style={styles.verText}>{cfg.text}</Text>
            {biz?.rejectionReason && (
              <Text style={[styles.verText, { color: colors.danger, marginTop: 4 }]}>Reason: {biz.rejectionReason}</Text>
            )}
          </View>
          {(verStatus === 'PENDING' || verStatus === 'REJECTED') && (
            <TouchableOpacity onPress={() => navigation.navigate('BusinessDocuments')} style={[styles.verBtn, { backgroundColor: cfg.color }]}>
              <Text style={styles.verBtnText}>Documents</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard icon="cube-outline"      label="Total Deliveries"   value={stats.totalDeliveries ?? 0} color={colors.primary} colors={colors} styles={styles} />
          <StatCard icon="calendar-outline"  label="This Month"         value={stats.monthlyDeliveries ?? 0} color={colors.info} colors={colors} styles={styles} />
          <StatCard icon="wallet-outline"    label="Total Spend"        value={formatMoney(stats.totalSpend ?? 0)} color={colors.accent} colors={colors} styles={styles} />
          <StatCard icon="time-outline"      label="Active Orders"      value={stats.pendingOrders ?? 0} color={colors.warning} colors={colors} styles={styles} />
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'add-circle-outline',    label: 'New Order',    screen: 'Send',              disabled: verStatus !== 'APPROVED' },
              { icon: 'receipt-outline',       label: 'Order History', screen: 'BusinessOrders' },
              { icon: 'document-text-outline', label: 'Documents',    screen: 'BusinessDocuments' },
              { icon: 'person-outline',        label: 'Profile',      screen: 'BusinessProfile' },
            ].map(a => (
              <TouchableOpacity
                key={a.label}
                onPress={() => !a.disabled && navigation.navigate(a.screen)}
                style={[styles.actionBtn, a.disabled && styles.actionBtnDisabled]}
              >
                <Ionicons name={a.icon} size={22} color={a.disabled ? colors.muted : colors.primary} />
                <Text style={[styles.actionLabel, a.disabled && { color: colors.muted }]}>{a.label}</Text>
                {a.disabled && <Text style={styles.actionNote}>Requires approval</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pricing */}
        {pricing && verStatus === 'APPROVED' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Pricing Tier</Text>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingTierLabel}>{pricing.label}</Text>
              {pricing.discountPercent > 0 && (
                <View style={styles.discountBadge}>
                  <Ionicons name="pricetag-outline" size={14} color="#fff" />
                  <Text style={styles.discountBadgeText}>{pricing.discountPercent}% partner discount applied</Text>
                </View>
              )}
              <View style={styles.pricingRow}>
                <Text style={styles.pricingKey}>Base Rate</Text>
                <Text style={styles.pricingVal}>{formatMoney(pricing.basePrice)}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingKey}>Per Kilometre</Text>
                <Text style={styles.pricingVal}>{formatMoney(pricing.pricePerKm)}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingKey}>Minimum Order</Text>
                <Text style={styles.pricingVal}>{formatMoney(pricing.minPrice)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent orders */}
        {recent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Recent Deliveries</Text>
              <TouchableOpacity onPress={() => navigation.navigate('BusinessOrders')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {recent.slice(0, 5).map(order => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderRow}
                onPress={() => navigation.navigate('TrackOrder', { orderId: order.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderRecipient} numberOfLines={1}>{order.recipientName}</Text>
                  <Text style={styles.orderAddr} numberOfLines={1}>{order.dropoffAddress}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.orderStatus, { color: STATUS_COLORS[order.status] ?? colors.muted }]}>{order.status}</Text>
                  <Text style={styles.orderPrice}>{formatMoney(order.finalPrice ?? order.estimatedPrice)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  headerSub:   { fontSize: 12, color: colors.muted, marginTop: 2 },
  bellBtn: { padding: 8 },

  verBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderRadius: radius.lg, padding: 14,
  },
  verStatus: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  verText:   { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  verBtn:    { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  verBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '44%', backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'flex-start', ...shadow.sm,
  },
  statIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },

  section:      { gap: 10 },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  seeAll:       { fontSize: 13, color: colors.accent, fontWeight: '700' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flex: 1, minWidth: '44%', backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center', gap: 6, ...shadow.sm,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  actionNote:  { fontSize: 10, color: colors.muted, textAlign: 'center' },

  pricingCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8,
  },
  pricingTierLabel: { fontSize: 14, fontWeight: '800', color: colors.accent, marginBottom: 4 },
  discountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.success ?? '#34C759', borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 4,
  },
  discountBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  pricingRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  pricingKey:  { fontSize: 13, color: colors.muted },
  pricingVal:  { fontSize: 13, fontWeight: '700', color: colors.text },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  orderRecipient: { fontSize: 13, fontWeight: '700', color: colors.text },
  orderAddr:      { fontSize: 12, color: colors.muted, marginTop: 2 },
  orderStatus:    { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  orderPrice:     { fontSize: 13, fontWeight: '900', color: colors.accent, marginTop: 2 },
});

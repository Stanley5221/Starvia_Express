import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../constants/theme';
import { formatGHS, formatGHSFull } from '../constants/currency';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

export default function EarningsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [period, setPeriod]       = useState('today');
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => { load(); }, [period]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const { data: res } = await api.get('/riders/earnings', { params: { period } });
      setData(res);
    } catch { setError('Could not load earnings'); }
    finally { setLoading(false); }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [period]);

  const periodLabel = period === 'today' ? 'today' : period === 'week' ? 'this week' : 'this month';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={[colors.primary + '28', colors.surface, colors.bg]}
          style={[styles.header, { paddingTop: insets.top + 20 }]}
        >
          <Text style={styles.pageTitle}>Earnings</Text>

          {/* Period tabs */}
          <View style={styles.tabs}>
            {TABS.map(t => (
              <TouchableOpacity key={t.id} onPress={() => setPeriod(t.id)} style={[styles.tab, period === t.id && styles.tabActive]}>
                <Text style={[styles.tabText, period === t.id && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {loading && !refreshing && (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
          )}

          {error && !loading && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={load} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {data && !loading && (
            <>
              {/* ── Hero earnings card ── */}
              <LinearGradient
                colors={[colors.primaryLight + '40', colors.primary + '25', colors.card]}
                style={styles.heroCard}
              >
                <View style={styles.heroIconRow}>
                  <View style={styles.heroIconBg}>
                    <Ionicons name="wallet" size={20} color={colors.accent} />
                  </View>
                  <Text style={styles.heroLabel}>Total earned {periodLabel}</Text>
                </View>
                <Text style={styles.heroAmount}>{formatGHSFull(data.total)}</Text>
                <Text style={styles.heroPill}>{data.deliveries} {data.deliveries === 1 ? 'delivery' : 'deliveries'} completed</Text>
              </LinearGradient>

              {/* ── Metrics row ── */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Ionicons name="cube" size={18} color={colors.accent} style={{ marginBottom: 6 }} />
                  <Text style={styles.metricVal}>{data.deliveries}</Text>
                  <Text style={styles.metricLabel}>Deliveries</Text>
                </View>
                <View style={styles.metricCard}>
                  <Ionicons name="trending-up" size={18} color={colors.success} style={{ marginBottom: 6 }} />
                  <Text style={styles.metricVal}>{formatGHS(data.avgPerJob ?? 0)}</Text>
                  <Text style={styles.metricLabel}>Avg / job</Text>
                </View>
                <View style={styles.metricCard}>
                  <Ionicons name="star" size={18} color={colors.warning} style={{ marginBottom: 6 }} />
                  <Text style={styles.metricVal}>{data.avgRating ? data.avgRating.toFixed(1) : '—'}</Text>
                  <Text style={styles.metricLabel}>Rating</Text>
                </View>
              </View>

              {/* ── Breakdown ── */}
              <Text style={styles.sectionLabel}>DELIVERY BREAKDOWN</Text>

              {(!data.breakdown || data.breakdown.length === 0) ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="cube-outline" size={36} color={colors.placeholder} />
                  <Text style={styles.emptyText}>No deliveries in this period</Text>
                </View>
              ) : (
                <View style={styles.breakdownList}>
                  {data.breakdown.map((item, idx) => (
                    <View key={item.orderId} style={[styles.breakdownRow, idx === data.breakdown.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.breakdownIcon}>
                        <Ionicons name="cube" size={16} color={colors.primary} />
                      </View>
                      <View style={styles.breakdownBody}>
                        <Text style={styles.breakdownRoute} numberOfLines={1}>{item.route}</Text>
                        <Text style={styles.breakdownMeta}>
                          {item.deliveredAt
                            ? new Date(item.deliveredAt).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : ''}
                          {item.recipientName ? `  ·  ${item.recipientName}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.breakdownAmount}>+{formatGHSFull(item.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 16 },

  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.md },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  tabTextActive: { color: colors.white },

  errorBox: { alignItems: 'center', padding: 40, gap: 8 },
  errorText: { color: colors.danger, fontSize: 14 },
  retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  retryText: { color: colors.primary, fontWeight: '700' },

  heroCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 24, marginBottom: 14, ...shadow.md },
  heroIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  heroIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + '22', alignItems: 'center', justifyContent: 'center' },
  heroLabel:  { fontSize: 13, color: colors.muted, fontWeight: '600' },
  heroAmount: { fontSize: 42, fontWeight: '900', color: colors.accent, marginBottom: 8 },
  heroPill:   { fontSize: 13, color: colors.muted },

  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  metricCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' },
  metricVal:  { fontSize: 18, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: 10, color: colors.muted, marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, marginBottom: 12 },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 48, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.muted, fontSize: 14 },

  breakdownList: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  breakdownRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  breakdownIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  breakdownBody: { flex: 1 },
  breakdownRoute:  { color: colors.text, fontWeight: '700', fontSize: 14 },
  breakdownMeta:   { color: colors.muted, fontSize: 11, marginTop: 2 },
  breakdownAmount: { color: colors.accent, fontWeight: '800', fontSize: 15, flexShrink: 0 },
});

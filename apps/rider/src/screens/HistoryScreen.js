import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { colors, radius, shadow } from '../constants/theme';
import { formatGHSFull } from '../constants/currency';

const FILTERS = [
  { id: 'All',       label: 'All',       icon: 'list' },
  { id: 'Delivered', label: 'Delivered', icon: 'checkmark-circle' },
  { id: 'Cancelled', label: 'Cancelled', icon: 'close-circle' },
  { id: 'Rated',     label: 'Rated',     icon: 'star' },
];

const STATUS_COLORS = {
  DELIVERED: colors.success,
  CANCELLED: colors.danger,
  default:   colors.muted,
};

function StarRow({ rating }) {
  if (!rating) return <Text style={styles.noRating}>Not rated</Text>;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={12} color={colors.warning} />
      ))}
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter]       = useState('All');
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail]       = useState(null);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const params = filter === 'All' ? {} : filter === 'Rated' ? { status: 'DELIVERED' } : { status: filter.toUpperCase() };
      const { data } = await api.get('/riders/orders', { params });
      setOrders(filter === 'Rated' ? data.filter(o => o.customerRating != null) : data);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [filter]);

  function statusColor(s) { return STATUS_COLORS[s] || STATUS_COLORS.default; }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Detail Modal ── */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>#{detail?.id?.slice(-8).toUpperCase()}</Text>
              <View style={[styles.statusChip, { borderColor: statusColor(detail?.status) + '50', backgroundColor: statusColor(detail?.status) + '18' }]}>
                <Text style={[styles.statusChipText, { color: statusColor(detail?.status) }]}>{detail?.status}</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={styles.modalSection}>
                <DetailRow icon="cube-outline"     label="Package"    value={detail?.packageDescription || '—'} />
                <DetailRow icon="resize-outline"   label="Size"       value={detail?.packageSize || '—'} />
                <DetailRow icon="person-outline"   label="Recipient"  value={detail?.recipientName} />
                <DetailRow icon="call-outline"     label="Phone"      value={detail?.recipientPhone} />
              </View>

              <View style={styles.routeDetailCard}>
                <View style={styles.routeDetailRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeDetailLabel}>Pickup</Text>
                    <Text style={styles.routeDetailAddr}>{detail?.pickupAddress}</Text>
                  </View>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeDetailRow}>
                  <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeDetailLabel}>Drop-off</Text>
                    <Text style={styles.routeDetailAddr}>{detail?.dropoffAddress}</Text>
                  </View>
                </View>
              </View>

              {detail?.customerRating != null && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color={colors.warning} />
                  <Text style={styles.ratingLabel}>Customer rating</Text>
                  <StarRow rating={detail.customerRating} />
                </View>
              )}

              <View style={styles.modalAmountRow}>
                <Text style={styles.modalAmountLabel}>Earnings</Text>
                <Text style={styles.modalAmount}>{formatGHSFull(detail?.finalPrice ?? detail?.estimatedPrice ?? 0)}</Text>
              </View>
            </ScrollView>

            <TouchableOpacity onPress={() => setDetail(null)}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
          <Text style={styles.pageTitle}>History</Text>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
              >
                <Ionicons name={f.icon + (filter === f.id ? '' : '-outline')} size={13} color={filter === f.id ? colors.white : colors.muted} />
                <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {loading && !refreshing && <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />}

          {!loading && orders.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="time-outline" size={40} color={colors.placeholder} />
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptyText}>Your completed orders will appear here.</Text>
            </View>
          )}

          {!loading && orders.map((o, idx) => {
            const amount  = o.finalPrice ?? o.estimatedPrice ?? 0;
            const pickup  = o.pickupAddress?.split(',')[0] || 'Pickup';
            const drop    = o.dropoffAddress?.split(',')[0] || 'Drop-off';
            const sColor  = statusColor(o.status);

            return (
              <TouchableOpacity key={o.id} onPress={() => setDetail(o)} activeOpacity={0.8}>
                <View style={styles.card}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <Text style={styles.orderId}>#{o.id.slice(-8).toUpperCase()}</Text>
                    <View style={[styles.statusChip, { borderColor: sColor + '50', backgroundColor: sColor + '18' }]}>
                      <Text style={[styles.statusChipText, { color: sColor }]}>{o.status}</Text>
                    </View>
                  </View>

                  {/* Route */}
                  <View style={styles.miniRoute}>
                    <View style={[styles.miniDot, { backgroundColor: colors.primary }]} />
                    <Text style={styles.miniAddr} numberOfLines={1}>{pickup}</Text>
                  </View>
                  <View style={[styles.miniRoute, { marginTop: 4 }]}>
                    <View style={[styles.miniDot, { backgroundColor: colors.accent }]} />
                    <Text style={styles.miniAddr} numberOfLines={1}>{drop}</Text>
                  </View>

                  {/* Footer */}
                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.cardDate}>
                        {new Date(o.createdAt).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {o.customerRating != null && <StarRow rating={o.customerRating} />}
                    </View>
                    <Text style={styles.cardAmount}>+{formatGHSFull(amount)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 16 },

  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  filterTextActive: { color: colors.white },

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textSecondary },
  emptyText:  { fontSize: 13, color: colors.muted },

  card: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10, ...shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId:  { fontSize: 12, fontWeight: '700', color: colors.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  statusChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusChipText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  miniRoute: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  miniAddr: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  cardDate:   { color: colors.muted, fontSize: 11, marginBottom: 4 },
  cardAmount: { color: colors.accent, fontWeight: '900', fontSize: 18 },
  noRating:   { color: colors.placeholder, fontSize: 11 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 32, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  modalSection: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginBottom: 14 },

  detailRow: { flexDirection: 'row', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

  routeDetailCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 14 },
  routeDetailRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeLine: { width: 2, height: 16, backgroundColor: colors.borderLight, marginLeft: 4, marginVertical: 4 },
  routeDetailLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeDetailAddr: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 14 },
  ratingLabel: { flex: 1, color: colors.muted, fontSize: 13 },

  modalAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.borderLight, marginBottom: 14 },
  modalAmountLabel: { color: colors.muted, fontSize: 14 },
  modalAmount: { color: colors.accent, fontWeight: '900', fontSize: 26 },

  closeBtn: { borderRadius: radius.md, padding: 16, alignItems: 'center' },
  closeBtnText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});

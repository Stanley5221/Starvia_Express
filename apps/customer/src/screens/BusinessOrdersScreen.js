import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow, STATUS_COLORS } from '../constants/theme';
import { formatMoney } from '../constants/currency';

const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Pending',   value: 'PENDING' },
  { label: 'Active',    value: 'ACCEPTED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function BusinessOrdersScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus]         = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);

  const fetchOrders = useCallback(async (pg = 1, st = status) => {
    if (pg === 1) setLoading(true); else setPageLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: 15 });
      if (st) params.append('status', st);
      const { data } = await api.get(`/business/orders?${params.toString()}`);
      setOrders(data.orders ?? data);
      setTotalPages(data.pages ?? 1);
      setPage(pg);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); setPageLoading(false); }
  }, [status]);

  useEffect(() => { fetchOrders(1, status); }, [status]);

  function renderItem({ item }) {
    const statusColor = STATUS_COLORS[item.status] ?? colors.muted;
    const saving = item.businessSaving ? formatMoney(item.businessSaving) : null;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recipient} numberOfLines={1}>{item.recipientName}</Text>
            <Text style={styles.addr} numberOfLines={1}>{item.dropoffAddress}</Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.statusChip, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
            </View>
            <Text style={styles.price}>{formatMoney(item.finalPrice ?? item.estimatedPrice)}</Text>
            {saving && <Text style={styles.saving}>Saved: {saving}</Text>}
          </View>
        </View>

        {item.rider && (
          <View style={styles.riderRow}>
            <Ionicons name="bicycle-outline" size={14} color={colors.muted} />
            <Text style={styles.riderText}>{item.rider.fullName} · {item.rider.motorPlate}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => navigation.navigate('TrackOrder', { orderId: item.id })}
        >
          <Ionicons name="navigate-outline" size={14} color={colors.primary} />
          <Text style={styles.trackBtnText}>Track Order</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
      </View>

      {/* Status filters */}
      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, status === f.value && styles.filterChipActive]}
            onPress={() => setStatus(f.value)}
          >
            <Text style={[styles.filterText, status === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(1, status); }} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="receipt-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 12, fontSize: 15 }}>No orders found</Text>
            </View>
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  disabled={page <= 1 || pageLoading}
                  onPress={() => fetchOrders(page - 1, status)}
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={18} color={page <= 1 ? colors.muted : colors.text} />
                </TouchableOpacity>
                <Text style={styles.pageText}>Page {page} of {totalPages}</Text>
                <TouchableOpacity
                  disabled={page >= totalPages || pageLoading}
                  onPress={() => fetchOrders(page + 1, status)}
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                >
                  {pageLoading ? <ActivityIndicator color={colors.text} size="small" /> : <Ionicons name="chevron-forward" size={18} color={page >= totalPages ? colors.muted : colors.text} />}
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  filterBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderLight },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText:       { fontSize: 13, fontWeight: '600', color: colors.muted },
  filterTextActive: { color: colors.white },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, ...shadow.sm,
  },
  cardTop:    { flexDirection: 'row', gap: 10 },
  recipient:  { fontSize: 14, fontWeight: '800', color: colors.text },
  addr:       { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  date:       { fontSize: 11, color: colors.muted, marginTop: 4 },
  statusChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  price:      { fontSize: 14, fontWeight: '900', color: colors.accent },
  saving:     { fontSize: 11, color: colors.success },
  riderRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riderText:  { fontSize: 12, color: colors.muted },
  trackBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary + '50' },
  trackBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 16 },
  pageBtn:         { padding: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  pageBtnDisabled: { opacity: 0.4 },
  pageText:        { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
});

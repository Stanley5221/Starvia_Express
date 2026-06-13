import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../constants/theme';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications ?? data);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchNotifications(); }, []);

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    } catch (_) {}
  }

  const unread = notifications.filter(n => !n.read).length;

  function renderItem({ item }) {
    return (
      <View style={[styles.card, !item.read && styles.cardUnread]}>
        <View style={styles.cardLeft}>
          {!item.read && <View style={styles.unreadDot} />}
          <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
            <Ionicons name="notifications" size={20} color={item.read ? colors.muted : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.notifMsg} numberOfLines={2}>{item.message}</Text>
            <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          {item.orderId && (
            <TouchableOpacity
              onPress={() => {
                if (!item.read) markRead(item.id);
                navigation.navigate('TrackOrder', { orderId: item.orderId });
              }}
              style={styles.viewBtn}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          )}
          {!item.read && (
            <TouchableOpacity onPress={() => markRead(item.id)} style={styles.readBtn}>
              <Ionicons name="checkmark" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 12, fontSize: 15 }}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  badge: {
    backgroundColor: colors.danger, borderRadius: 99,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, ...shadow.sm,
  },
  cardUnread: { borderColor: colors.primary + '60', backgroundColor: colors.primary + '14' },
  cardLeft:   { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  unreadDot: {
    position: 'absolute', left: -2, top: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4,
    elevation: 2,
  },
  iconWrap:       { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  iconWrapUnread: { backgroundColor: colors.primary + '30', borderWidth: 1, borderColor: colors.primary + '40' },
  notifTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 3 },
  notifMsg:   { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  notifTime:  { fontSize: 11, color: colors.muted, marginTop: 5 },
  cardActions: { gap: 6, alignItems: 'flex-end' },
  viewBtn: {
    backgroundColor: colors.primary + '20', borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  viewBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  readBtn: { padding: 4 },
});

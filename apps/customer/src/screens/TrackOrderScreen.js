import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Animated, ActivityIndicator, Alert, Dimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LinearGradient from 'react-native-linear-gradient';
import * as Haptics from 'expo-haptics';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow, STATUS_LABELS, STATUS_COLORS } from '../constants/theme';
import { formatMoney } from '../constants/currency';
import StatusBadge from '../components/StatusBadge';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const { height } = Dimensions.get('window');
const MAP_H = height * 0.50;
const ACTIVE = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'];
const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Live Map ─────────────────────────────────────────────────────────────────
function TrackMap({ order, riderCoords, routeCoords, riderRouteCoords, style }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  if (Platform.OS === 'web') {
    return (
      <View style={[style, styles.mapFallback]}>
        <Ionicons name="map-outline" size={40} color={colors.muted} />
        <Text style={{ color: colors.muted, marginTop: 8 }}>Live map on mobile</Text>
      </View>
    );
  }
  try {
    const MapboxGL = require('@rnmapbox/maps').default;
    const cameraRef = useRef(null);

    useEffect(() => {
      if (!cameraRef.current || !order) return;
      if (riderCoords) {
        cameraRef.current.setCamera({ centerCoordinate: riderCoords, zoomLevel: 15, animationDuration: 600 });
      }
    }, [riderCoords]);

    const routeGeoJSON = routeCoords
      ? { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } } : null;

    const riderRouteGeoJSON = riderRouteCoords
      ? { type: 'Feature', geometry: { type: 'LineString', coordinates: riderRouteCoords } } : null;

    return (
      <MapboxGL.MapView style={style} styleURL={MapboxGL.StyleURL.Dark} logoEnabled={false} attributionEnabled={false}>
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={order ? [order.pickupLng, order.pickupLat] : [0, 5.6]}
        />
        {/* Static route */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="staticRoute" shape={routeGeoJSON}>
            <MapboxGL.LineLayer id="staticLine" style={{ lineColor: colors.info + '60', lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
          </MapboxGL.ShapeSource>
        )}
        {/* Rider route */}
        {riderRouteGeoJSON && (
          <MapboxGL.ShapeSource id="riderRoute" shape={riderRouteGeoJSON}>
            <MapboxGL.LineLayer id="riderLine" style={{ lineColor: colors.accent, lineWidth: 4, lineDasharray: [2, 2], lineCap: 'round' }} />
          </MapboxGL.ShapeSource>
        )}
        {/* Pickup pin */}
        {order && (
          <MapboxGL.PointAnnotation id="pickup" coordinate={[order.pickupLng, order.pickupLat]}>
            <View style={[styles.pin, { backgroundColor: colors.purple }]}>
              <Ionicons name="navigate" size={13} color="#fff" />
            </View>
          </MapboxGL.PointAnnotation>
        )}
        {/* Dropoff pin */}
        {order && (
          <MapboxGL.PointAnnotation id="dropoff" coordinate={[order.dropoffLng, order.dropoffLat]}>
            <View style={[styles.pin, { backgroundColor: colors.accent }]}>
              <Ionicons name="location" size={13} color="#fff" />
            </View>
          </MapboxGL.PointAnnotation>
        )}
        {/* Rider marker */}
        {riderCoords && (
          <MapboxGL.PointAnnotation id="rider" coordinate={riderCoords}>
            <View style={styles.riderPin}>
              <Text style={{ fontSize: 20 }}>🏍️</Text>
            </View>
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>
    );
  } catch {
    return (
      <View style={[style, styles.mapFallback]}>
        <Ionicons name="map-outline" size={40} color={colors.muted} />
      </View>
    );
  }
}

// ── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ rating, onChange }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)}>
          <Ionicons
            name={n <= rating ? 'star' : 'star-outline'}
            size={32}
            color={n <= rating ? colors.accent : colors.muted}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TrackOrderScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { orderId } = route.params || {};
  const insets      = useSafeAreaInsets();
  const lastRiderPos = useRef({ lat: null, lng: null });

  const [order, setOrder]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [riderCoords, setRiderCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [riderRouteCoords, setRiderRouteCoords] = useState(null);
  const [distKm, setDistKm]         = useState(null);
  const [rating, setRating]         = useState(0);
  const [review, setReview]         = useState('');
  const [ratingSent, setRatingSent] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [cancelling, setCancelling]       = useState(false);
  const orderRef = useRef(null);
  useEffect(() => { orderRef.current = order; }, [order]);

  // Fetch initial static route
  async function fetchStaticRoute(o) {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${o.pickupLng},${o.pickupLat};${o.dropoffLng},${o.dropoffLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const d   = await res.json();
      const coords = d.routes?.[0]?.geometry?.coordinates;
      if (coords) setRouteCoords(coords);
    } catch (_) {}
  }

  // Update rider-to-dest route (throttled)
  const updateRiderRoute = useCallback(async (lat, lng, dest) => {
    const last = lastRiderPos.current;
    const moved = !last.lat || haversineKm(lat, lng, last.lat, last.lng) > 0.3;
    if (!moved) return;
    lastRiderPos.current = { lat, lng };
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${lng},${lat};${dest[0]},${dest[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const d   = await res.json();
      const coords = d.routes?.[0]?.geometry?.coordinates;
      if (coords) setRiderRouteCoords(coords);
    } catch (_) {}
  }, []);

  function handleRiderLocation({ lat, lng }) {
    const coords = [lng, lat];
    setRiderCoords(coords);
    const o = orderRef.current;
    if (!o || o.status === 'DELIVERED') return;
    const goingToDropoff = ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED'].includes(o.status);
    const dest = goingToDropoff ? [o.dropoffLng, o.dropoffLat] : [o.pickupLng, o.pickupLat];
    setDistKm(haversineKm(lat, lng, dest[1], dest[0]).toFixed(1));
    updateRiderRoute(lat, lng, dest);
  }

  useEffect(() => {
    api.get(`/orders/${orderId}`)
      .then(r => {
        setOrder(r.data);
        setRatingSent(!!r.data.customerRating);
        setRating(r.data.customerRating || 0);
        fetchStaticRoute(r.data);
        if (r.data.rider?.lastLat) {
          handleRiderLocation({ lat: r.data.rider.lastLat, lng: r.data.rider.lastLng });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    let socket;
    connectSocket().then(s => {
      socket = s;
      socket.emit('order:watch', { orderId });
      socket.on('rider:location', handleRiderLocation);
      socket.on('order:status_changed', ({ status }) => {
        setOrder(o => o ? { ...o, status } : o);
        if (status === 'DELIVERED' && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      });
      socket.on('order:assigned', ({ rider }) => {
        setOrder(o => o ? { ...o, rider: { ...o.rider, ...rider, fullName: rider.name } } : o);
      });
    }).catch(() => {});
    return () => {
      if (socket) {
        socket.off('rider:location', handleRiderLocation);
        socket.off('order:status_changed');
        socket.off('order:assigned');
      }
    };
  }, [orderId, order?.id]);

  async function submitRating() {
    if (!rating) return Alert.alert('Rating required', 'Please select a star rating.');
    setRatingLoading(true);
    try {
      await api.post(`/orders/${orderId}/rate`, { rating, review });
      setRatingSent(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not submit rating.');
    } finally {
      setRatingLoading(false);
    }
  }

  async function cancelOrder() {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this delivery?',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Yes, cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.patch(`/orders/${orderId}/cancel`);
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Could not cancel order.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.muted, marginTop: 12 }}>Loading order…</Text>
      </View>
    );
  }
  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
        <Text style={{ color: colors.muted, marginTop: 12 }}>Order not found</Text>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusIdx  = STATUS_STEPS.indexOf(order.status);
  const delivered  = order.status === 'DELIVERED';
  const cancelled  = order.status === 'CANCELLED';
  const statusColor = STATUS_COLORS[order.status] || colors.muted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Map */}
      <View style={{ height: MAP_H }}>
        <TrackMap
          order={order}
          riderCoords={riderCoords}
          routeCoords={routeCoords}
          riderRouteCoords={riderRouteCoords}
          style={StyleSheet.absoluteFill}
        />
        {/* Overlay: back + order ID */}
        <View style={[styles.mapOverlay, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')} style={styles.mapBackBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.mapOrderId}>
            <Text style={styles.mapOrderIdText}>#{order.id.slice(-8).toUpperCase()}</Text>
          </View>
          <StatusBadge status={order.status} size="sm" />
        </View>
        {/* Delivered overlay */}
        {delivered && (
          <View style={styles.deliveredOverlay}>
            <LinearGradient colors={[colors.success, '#059669']} style={styles.deliveredBadge}>
              <Ionicons name="checkmark-done-circle" size={22} color="#fff" />
              <Text style={styles.deliveredText}>Delivered!</Text>
            </LinearGradient>
          </View>
        )}
        {/* Distance pill */}
        {distKm && ACTIVE.includes(order.status) && (
          <View style={styles.distPill}>
            <Ionicons name="bicycle-outline" size={13} color={colors.accent} />
            <Text style={styles.distText}>~{distKm} km away</Text>
          </View>
        )}
      </View>

      {/* Bottom panel */}
      <ScrollView
        style={styles.panel}
        contentContainerStyle={[styles.panelContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status bar */}
        {!cancelled && !delivered && (
          <View style={styles.statusBar}>
            {STATUS_STEPS.map((s, i) => (
              <View key={s} style={styles.statusStep}>
                <View style={[
                  styles.statusDot,
                  i <= statusIdx && { backgroundColor: STATUS_COLORS[s] || colors.primary },
                ]} />
                {i < STATUS_STEPS.length - 1 && (
                  <View style={[styles.statusLine, i < statusIdx && { backgroundColor: colors.success }]} />
                )}
              </View>
            ))}
          </View>
        )}
        <Text style={styles.statusLabel}>
          {cancelled ? '❌ Cancelled' : STATUS_LABELS[order.status]}
        </Text>

        {/* Route summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.purple }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeAddr} numberOfLines={2}>{order.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Drop-off</Text>
              <Text style={styles.routeAddr} numberOfLines={2}>{order.dropoffAddress}</Text>
            </View>
          </View>
          <View style={[styles.priceRow]}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>{formatMoney(order.finalPrice ?? order.estimatedPrice)}</Text>
          </View>
        </View>

        {/* Rider card */}
        {order.rider && (
          <View style={styles.riderCard}>
            {order.rider.profilePhoto ? (
              <Image
                source={{ uri: order.rider.profilePhoto.startsWith('http')
                  ? order.rider.profilePhoto
                  : `${process.env.EXPO_PUBLIC_API_URL}${order.rider.profilePhoto}` }}
                style={styles.riderAvatar}
              />
            ) : (
              <View style={styles.riderAvatar}>
                <Text style={{ fontSize: 22 }}>🏍️</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{order.rider.fullName}</Text>
              <Text style={styles.riderMeta}>
                {order.rider.motorPlate} · {order.rider.motorColor} {order.rider.motorMake}
              </Text>
            </View>
            {order.rider.phone && (
              <TouchableOpacity
                onPress={() => {}}
                style={styles.callBtn}
              >
                <Ionicons name="call" size={16} color={colors.success} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Rating */}
        {delivered && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>
              {ratingSent ? '⭐ Thank you for your rating!' : 'Rate your delivery'}
            </Text>
            {!ratingSent ? (
              <>
                <StarRating rating={rating} onChange={setRating} />
                <TouchableOpacity
                  onPress={submitRating}
                  disabled={ratingLoading || !rating}
                  style={[styles.ratingBtn, (!rating || ratingLoading) && { opacity: 0.5 }]}
                >
                  <LinearGradient
                    colors={[colors.accent, '#d97706']}
                    style={styles.ratingBtnGrad}
                  >
                    {ratingLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.ratingBtnText}>Submit Rating</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
                You rated this delivery {rating} star{rating !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        )}

        {/* Pending / no-rider message */}
        {order.status === 'PENDING' && (
          <>
            <View style={styles.pendingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.pendingText}>Looking for an available rider…</Text>
            </View>
            <TouchableOpacity
              onPress={cancelOrder}
              disabled={cancelling}
              style={[styles.cancelBtn, cancelling && { opacity: 0.5 }]}
            >
              {cancelling
                ? <ActivityIndicator color={colors.danger} size="small" />
                : <Text style={styles.cancelBtnText}>Cancel Order</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  mapFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  pin: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', ...shadow.md },
  riderPin: { alignItems: 'center', justifyContent: 'center' },

  mapOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  mapBackBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
    alignItems: 'center', justifyContent: 'center',
  },
  mapOrderId: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  mapOrderIdText: { color: '#fff', fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },

  deliveredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  deliveredBadge:   { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 99, ...shadow.lg },
  deliveredText:    { color: '#fff', fontWeight: '800', fontSize: 16 },

  distPill: {
    position: 'absolute', bottom: 14, left: 14,
    flexDirection: 'row', gap: 5, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  distText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  panel:        { flex: 1, backgroundColor: colors.bg },
  panelContent: { padding: 16, gap: 12 },

  statusBar:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.borderLight },
  statusLine: { flex: 1, height: 2, backgroundColor: colors.borderLight, marginHorizontal: 2 },
  statusLabel:{ fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 12 },

  routeCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  routeRow:       { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  routeDot:       { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
  routeConnector: { width: 2, height: 16, backgroundColor: colors.borderLight, marginLeft: 5, marginVertical: 4 },
  routeLabel:     { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddr:      { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 },
  priceRow:       { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 10, paddingTop: 10 },
  priceLabel:     { fontSize: 13, color: colors.muted },
  priceValue:     { fontSize: 16, fontWeight: '900', color: colors.accent },

  riderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  riderAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  riderName: { fontSize: 15, fontWeight: '800', color: colors.text },
  riderMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.success + '18',
    borderWidth: 1, borderColor: colors.success + '30',
    alignItems: 'center', justifyContent: 'center',
  },

  ratingCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accent + '30',
    padding: 16, alignItems: 'center', gap: 12,
  },
  ratingTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  stars:       { flexDirection: 'row', gap: 6 },
  ratingBtn:   { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  ratingBtnGrad: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  ratingBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  pendingCard: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  pendingText: { color: colors.textSecondary, fontSize: 13 },

  cancelBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.danger,
    backgroundColor: colors.danger + '12',
  },
  cancelBtnText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});

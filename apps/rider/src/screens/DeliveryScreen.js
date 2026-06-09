import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Mapbox from '@rnmapbox/maps';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { useActiveOrder } from '../context/ActiveOrderContext';
import { useTheme } from '../context/ThemeContext';

function initials(name) {
  return (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function DeliveryScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { rider } = useAuth();
  const { activeOrder, refreshActiveOrder, setActiveOrder } = useActiveOrder();
  const [order, setOrder] = useState(activeOrder);
  const [updating, setUpdating] = useState(false);
  const [gpsOn, setGpsOn] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const locSub = useRef(null);

  useFocusEffect(
    useCallback(() => {
      refreshActiveOrder().then(setOrder);
    }, [refreshActiveOrder])
  );

  useEffect(() => {
    setOrder(activeOrder);
  }, [activeOrder]);

  useEffect(() => {
    if (!order?.id || !rider?.id) return undefined;
    let cancelled = false;
    startGps(() => cancelled);
    return () => {
      cancelled = true;
      stopGps();
    };
  }, [order?.id, rider?.id]);

  function stopGps() {
    const sub = locSub.current;
    locSub.current = null;
    if (!sub) return;
    if (typeof sub === 'number') {
      clearInterval(sub);
    } else if (typeof sub.remove === 'function') {
      try {
        sub.remove();
      } catch (_) {
        // expo-location web cleanup can throw; ignore
      }
    }
    setGpsOn(false);
  }

  async function startGps(isCancelled) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted' || isCancelled()) return;

    const socket = await connectSocket();
    const orderId = order.id;
    const riderId = rider.id;

    const emitLocation = (lat, lng) => {
      if (isCancelled()) return;
      setGpsOn(true);
      setCurrentPos({ lat, lng });
      socket.emit('rider:location', { riderId, orderId, lat, lng });
    };

    if (Platform.OS === 'web') {
      const poll = async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          emitLocation(pos.coords.latitude, pos.coords.longitude);
        } catch (_) {
          // ignore geolocation errors on web
        }
      };
      await poll();
      if (!isCancelled()) locSub.current = setInterval(poll, 5000);
      return;
    }

    try {
      locSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        ({ coords }) => emitLocation(coords.latitude, coords.longitude),
      );
    } catch (_) {
      // GPS unavailable
    }
  }

  // Fetch the Mapbox Directions route whenever the rider moves or the destination changes.
  // Re-runs every GPS tick (~5 s); AbortController cancels in-flight requests on re-run.
  useEffect(() => {
    if (!currentPos || !order || Platform.OS === 'web') return;
    const toLat = !order.pickedUpAt ? order.pickupLat : order.dropoffLat;
    const toLng = !order.pickedUpAt ? order.pickupLng : order.dropoffLng;
    if (!toLat || !toLng) return;
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    const ctrl = new AbortController();
    fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${currentPos.lng},${currentPos.lat};${toLng},${toLat}?geometries=geojson&overview=full&access_token=${token}`,
      { signal: ctrl.signal },
    )
      .then(r => r.json())
      .then(data => { if (data.routes?.[0]) setRouteCoords(data.routes[0].geometry.coordinates); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [currentPos, order]);

  async function patchStatus(status, extra = {}) {
    if (!order?.id) return;
    setUpdating(true);
    try {
      const { data } = await api.patch(`/orders/${order.id}/status`, { status, ...extra });
      setOrder(data);
      if (status === 'DELIVERED') {
        setShowDeliveryModal(false);
        stopGps();
        setActiveOrder(null);
        setOrder(null);
        Alert.alert('Done', extra.deliveryPhotoUrl
          ? 'Delivery completed with photo saved.'
          : 'Delivery completed!');
      } else {
        setActiveOrder(data);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  async function pickDeliveryPhoto(source) {
    try {
      let result;
      if (source === 'camera') {
        if (Platform.OS === 'web') {
          Alert.alert(
            'Camera on web',
            'Browsers cannot open the camera here. Choose a photo from your gallery, or complete without a photo.',
          );
          return;
        }
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Camera', 'Camera permission is required.');
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.5,
          base64: true,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert('Photos', 'Photo library permission is required.');
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.5,
          base64: true,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        return Alert.alert('Photo error', 'Could not read the image. Try another photo or complete without one.');
      }
      const photo = `data:image/jpeg;base64,${asset.base64}`;
      await patchStatus('DELIVERED', { deliveryPhotoUrl: photo });
    } catch (err) {
      Alert.alert('Photo error', err.message || 'Could not use that photo');
    }
  }

  function confirmDelivery() {
    if (Platform.OS === 'web') {
      setShowDeliveryModal(true);
      return;
    }
    Alert.alert(
      'Complete delivery',
      'Optional: add a proof-of-delivery photo (saved to the order in the database).',
      [
        { text: 'Take photo', onPress: () => pickDeliveryPhoto('camera') },
        { text: 'Choose from gallery', onPress: () => pickDeliveryPhoto('library') },
        { text: 'Complete without photo', onPress: () => patchStatus('DELIVERED') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function closeDeliveryModal() {
    setShowDeliveryModal(false);
  }

  async function completeFromModal(source) {
    closeDeliveryModal();
    if (source === 'none') {
      await patchStatus('DELIVERED');
      return;
    }
    await pickDeliveryPhoto(source);
  }

  function openMaps(lat, lng, label) {
    const q = lat && lng ? `${lat},${lng}` : encodeURIComponent(label);
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
  }

  if (!order) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No active delivery.</Text>
        <Text style={styles.emptySub}>Go online and accept an order from Home.</Text>
      </View>
    );
  }

  const goingPickup = !order.pickedUpAt;
  const atPickup = order.status === 'ARRIVED' && !order.pickedUpAt;
  const inTransit = ['PICKED_UP', 'IN_TRANSIT'].includes(order.status) || (order.pickedUpAt && order.status === 'ARRIVED');
  const atDropoff = order.status === 'ARRIVED' && order.pickedUpAt;

  let statusPill = '● ACCEPTED · Going to pickup';
  let primaryLabel = "I've arrived at pickup";
  let primaryAction = () => patchStatus('ARRIVED');

  if (atPickup) {
    statusPill = '● ARRIVED AT PICKUP';
    primaryLabel = 'Confirm package picked up';
    primaryAction = () => patchStatus('PICKED_UP');
  } else if (order.status === 'PICKED_UP') {
    statusPill = '● IN TRANSIT · Going to drop-off';
    primaryLabel = "I've arrived at drop-off";
    primaryAction = () => patchStatus('ARRIVED');
  } else if (atDropoff) {
    statusPill = '● ARRIVED AT DROP-OFF';
    primaryLabel = 'Confirm delivery complete';
    primaryAction = confirmDelivery;
  }

  const destName = goingPickup || atPickup ? order.pickupAddress?.split(',')[0] : order.dropoffAddress?.split(',')[0];
  const destAddress = goingPickup || atPickup ? order.pickupAddress : order.dropoffAddress;
  const contactName = goingPickup || atPickup ? order.pickupContactName : order.recipientName;
  const contactPhone = goingPickup || atPickup ? order.pickupPhone : order.recipientPhone;
  const contactLabel = goingPickup || atPickup ? 'Pickup contact' : 'Recipient';
  const notes = goingPickup || atPickup ? order.pickupNotes : order.dropoffNotes;
  const mapLat = goingPickup || atPickup ? order.pickupLat : order.dropoffLat;
  const mapLng = goingPickup || atPickup ? order.pickupLng : order.dropoffLng;

  const deliveryModal = showDeliveryModal ? (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={styles.modalScrim} activeOpacity={1} onPress={closeDeliveryModal} />
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Complete delivery</Text>
        <Text style={styles.modalSub}>
          Add a proof photo (saved on the order) or finish without one.
        </Text>
        <TouchableOpacity
          style={styles.modalBtn}
          onPress={() => completeFromModal('library')}
          disabled={updating}
        >
          <Text style={styles.modalBtnText}>Choose from gallery</Text>
        </TouchableOpacity>
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.modalBtn}
            onPress={() => completeFromModal('camera')}
            disabled={updating}
          >
            <Text style={styles.modalBtnText}>Take photo</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.modalBtn, styles.modalBtnPrimary]}
          onPress={() => completeFromModal('none')}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.modalBtnPrimaryText}>Complete without photo</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalCancel} onPress={closeDeliveryModal}>
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {deliveryModal}

      <View style={styles.mapArea}>
        {Platform.OS !== 'web' ? (
          <Mapbox.MapView
            style={StyleSheet.absoluteFillObject}
            styleURL="mapbox://styles/mapbox/navigation-night-v1"
            logoEnabled={false}
            attributionEnabled={false}
          >
            {/* Camera follows rider position */}
            {currentPos ? (
              <Mapbox.Camera
                zoomLevel={15}
                centerCoordinate={[currentPos.lng, currentPos.lat]}
                animationMode="flyTo"
                animationDuration={800}
              />
            ) : (
              <Mapbox.Camera
                zoomLevel={14}
                centerCoordinate={[mapLng || 0, mapLat || 0]}
              />
            )}

            {/* Route line from rider to destination */}
            {routeCoords && routeCoords.length > 1 && (
              <Mapbox.ShapeSource
                id="route-source"
                shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } }}
              >
                <Mapbox.LineLayer
                  id="route-casing"
                  style={{ lineColor: '#0f172a', lineWidth: 10, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.55 }}
                />
                <Mapbox.LineLayer
                  id="route-line"
                  style={{ lineColor: colors.primary, lineWidth: 6, lineCap: 'round', lineJoin: 'round' }}
                />
              </Mapbox.ShapeSource>
            )}

            {/* Destination marker (pickup or dropoff) */}
            {mapLat != null && mapLng != null && (
              <Mapbox.PointAnnotation id="destination" coordinate={[mapLng, mapLat]}>
                <View style={styles.mapMarker}>
                  <Text style={styles.mapMarkerText}>{goingPickup || atPickup ? '📍' : '🏁'}</Text>
                </View>
              </Mapbox.PointAnnotation>
            )}

            {/* Rider current position marker */}
            {currentPos && (
              <Mapbox.PointAnnotation id="rider-pos" coordinate={[currentPos.lng, currentPos.lat]}>
                <View style={styles.mapMarker}>
                  <Text style={styles.mapMarkerText}>🏍️</Text>
                </View>
              </Mapbox.PointAnnotation>
            )}
          </Mapbox.MapView>
        ) : (
          <>
            <Text style={styles.mapPlaceholder}>🗺️ Map view</Text>
            <Text style={styles.mapHint}>Use a device build for live navigation</Text>
          </>
        )}

        {gpsOn && (
          <View style={styles.gpsBadge}>
            <Text style={styles.gpsText}>● GPS on</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.statusPill}>{statusPill}</Text>
        <Text style={styles.destName}>{destName}</Text>
        <Text style={styles.destAddr}>{destAddress}</Text>

        <View style={styles.contactCard}>
          <View style={styles.contactAvatar}><Text style={styles.contactInitials}>{initials(contactName)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactName}>{contactName}</Text>
            <Text style={styles.contactLabel}>{contactLabel}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${contactPhone}`)}>
            <Text style={styles.callText}>📞 Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smsBtn} onPress={() => Linking.openURL(`sms:${contactPhone}`)}>
            <Text style={styles.smsText}>💬</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.packageLine}>
          📦 {order.packageSize || 'Medium'} · {order.packageDescription || 'Package'}
          {notes ? ` · ${notes}` : ''}
        </Text>

        {inTransit && !atDropoff && (
          <View style={styles.recipientBlock}>
            <Text style={styles.recipientTitle}>Delivering to</Text>
            <Text style={styles.recipientName}>{order.recipientName}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.recipientPhone}`)}>
              <Text style={styles.recipientPhone}>{order.recipientPhone}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.mapsBtn} onPress={() => openMaps(mapLat, mapLng, destAddress)}>
          <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={primaryAction} disabled={updating}>
          {updating ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapArea: { height: '42%', backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  mapPlaceholder: { fontSize: 28 },
  mapHint: { color: colors.muted, fontSize: 12, marginTop: 8 },
  gpsBadge: { position: 'absolute', top: 48, right: 16, backgroundColor: colors.bgDark, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.primary },
  gpsText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  panel: { flex: 1 },
  panelContent: { padding: 20, paddingBottom: Platform.OS === 'web' ? 48 : 32 },
  statusPill: { color: colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  destName: { color: colors.text, fontSize: 22, fontWeight: '800' },
  destAddr: { color: colors.muted, fontSize: 13, marginBottom: 16 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  contactInitials: { color: colors.bg, fontWeight: '800' },
  contactName: { color: colors.text, fontWeight: '700' },
  contactLabel: { color: colors.muted, fontSize: 11 },
  callBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.primary },
  callText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  smsBtn: { padding: 8, backgroundColor: colors.border, borderRadius: 8 },
  smsText: { fontSize: 14 },
  packageLine: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  recipientBlock: { marginBottom: 12, padding: 12, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  recipientTitle: { color: colors.muted, fontSize: 11 },
  recipientName: { color: colors.text, fontWeight: '700', marginTop: 4 },
  recipientPhone: { color: colors.primary, marginTop: 4 },
  mapsBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 },
  mapsBtnText: { color: colors.muted, fontWeight: '600' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, padding: 18, alignItems: 'center' },
  primaryText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  mapMarker: { alignItems: 'center', justifyContent: 'center' },
  mapMarkerText: { fontSize: 24, lineHeight: 28 },
  empty: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: colors.muted, marginTop: 8, textAlign: 'center' },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    zIndex: 1001,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalSub: { color: colors.muted, fontSize: 13, marginBottom: 16, lineHeight: 20 },
  modalBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnText: { color: colors.text, fontWeight: '600' },
  modalBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalBtnPrimaryText: { color: colors.bg, fontWeight: '800' },
  modalCancel: { alignItems: 'center', paddingTop: 4 },
  modalCancelText: { color: colors.muted, fontWeight: '600' },
});

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Dimensions, FlatList, Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LinearGradient from 'react-native-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../constants/theme';
import { formatMoney } from '../constants/currency';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const { width, height } = Dimensions.get('window');
const STEPS = ['Locations', 'Details', 'Confirm'];
const SIZES = [
  { id: 'small',  label: 'Small',  icon: 'mail-outline',  desc: 'Envelope, docs' },
  { id: 'medium', label: 'Medium', icon: 'cube-outline',  desc: 'Shoebox, bag' },
  { id: 'large',  label: 'Large',  icon: 'archive-outline', desc: 'Large box' },
];

// ── Google Places via backend proxy (better Ghana coverage) ──────────────────
async function geocodeForward(query) {
  if (!query || query.length < 2) return [];
  try {
    const res  = await api.get(`/places/autocomplete?q=${encodeURIComponent(query)}`);
    return res.data || [];
  } catch { return []; }
}

async function getPlaceDetails(placeId) {
  try {
    const res  = await api.get(`/places/details?place_id=${encodeURIComponent(placeId)}`);
    return res.data || null;
  } catch { return null; }
}

async function geocodeReverse(lng, lat) {
  try {
    const res  = await api.get(`/places/reverse?lat=${lat}&lng=${lng}`);
    return res.data?.address || null;
  } catch { return null; }
}

async function fetchDirections(pickup, dropoff) {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup[0]},${pickup[1]};${dropoff[0]},${dropoff[1]}?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;
    const res  = await fetch(url);
    const data = await res.json();
    return data.routes?.[0] || null;
  } catch { return null; }
}

// â”€â”€ Address Search Input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AddressInput({ label, value, onChange, onSelect, placeholder, showGPS, onGPS, gpsLoading, color }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching]     = useState(false);
  const debounce = useRef(null);
  const seq      = useRef(0);

  async function handleChange(text) {
    onChange(text);
    clearTimeout(debounce.current);
    if (text.length < 2) { setSuggestions([]); return; }
    const id = ++seq.current;
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const results = await geocodeForward(text);
      if (id !== seq.current) return;
      setSuggestions(results);
      setSearching(false);
    }, 300);
  }

  async function select(prediction) {
    setSuggestions([]);
    setSearching(true);
    const details = await getPlaceDetails(prediction.place_id);
    setSearching(false);
    if (!details) return;
    onSelect({ address: details.address, lng: details.lng, lat: details.lat });
  }

  return (
    <View style={styles.addressGroup}>
      <View style={[styles.addressLabelRow]}>
        <View style={[styles.addressDot, { backgroundColor: color }]} />
        <Text style={styles.addressLabel}>{label}</Text>
        {searching && <ActivityIndicator size="small" color={color} style={{ marginLeft: 8 }} />}
      </View>
      <View style={styles.addressInputRow}>
        <TextInput
          style={[styles.addressInput, { borderColor: value ? color + '50' : colors.borderLight }]}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
        />
        {showGPS && (
          <TouchableOpacity onPress={onGPS} disabled={gpsLoading} style={[styles.gpsBtn, { borderColor: color + '40' }]}>
            {gpsLoading
              ? <ActivityIndicator size="small" color={color} />
              : <Ionicons name="navigate" size={16} color={color} />}
          </TouchableOpacity>
        )}
      </View>
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.slice(0, 5).map((p, i) => (
            <TouchableOpacity
              key={p.place_id || i}
              onPress={() => select(p)}
              style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionBorder]}
            >
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.suggMain} numberOfLines={1}>{p.main}</Text>
                <Text style={styles.suggSub} numberOfLines={1}>{p.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// â”€â”€ Mapbox Map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DeliveryMap({ pickupCoords, dropoffCoords, routeCoords, style }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  if (Platform.OS === 'web') {
    return (
      <View style={[style, styles.mapPlaceholder]}>
        <Ionicons name="map-outline" size={40} color={colors.muted} />
        <Text style={styles.mapPlaceholderText}>Map available on mobile</Text>
      </View>
    );
  }
  try {
    const MapboxGL = require('@rnmapbox/maps').default;
    const cameraRef = useRef(null);

    useEffect(() => {
      if (!cameraRef.current) return;
      if (pickupCoords && dropoffCoords) {
        try {
          cameraRef.current.fitBounds(
            [Math.max(pickupCoords[0], dropoffCoords[0]), Math.max(pickupCoords[1], dropoffCoords[1])],
            [Math.min(pickupCoords[0], dropoffCoords[0]), Math.min(pickupCoords[1], dropoffCoords[1])],
            [80, 40, 280, 40], 800,
          );
        } catch (_) {}
      } else if (pickupCoords) {
        cameraRef.current.setCamera({ centerCoordinate: pickupCoords, zoomLevel: 14, animationDuration: 600 });
      }
    }, [pickupCoords, dropoffCoords]);

    const routeGeoJSON = routeCoords
      ? { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } }
      : null;

    return (
      <MapboxGL.MapView style={style} styleURL={MapboxGL.StyleURL.Dark} logoEnabled={false} attributionEnabled={false}>
        <MapboxGL.Camera ref={cameraRef} zoomLevel={13} centerCoordinate={[0, 5.6]} />

        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="route" shape={routeGeoJSON}>
            <MapboxGL.LineLayer id="routeLine" style={{ lineColor: colors.primary, lineWidth: 4, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.9 }} />
          </MapboxGL.ShapeSource>
        )}
        {pickupCoords && (
          <MapboxGL.PointAnnotation id="pickup" coordinate={pickupCoords}>
            <View style={[styles.mapPin, { backgroundColor: colors.purple }]}>
              <Ionicons name="navigate" size={12} color="#fff" />
            </View>
          </MapboxGL.PointAnnotation>
        )}
        {dropoffCoords && (
          <MapboxGL.PointAnnotation id="dropoff" coordinate={dropoffCoords}>
            <View style={[styles.mapPin, { backgroundColor: colors.accent }]}>
              <Ionicons name="location" size={12} color="#fff" />
            </View>
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>
    );
  } catch (_) {
    return (
      <View style={[style, styles.mapPlaceholder]}>
        <Ionicons name="map-outline" size={40} color={colors.muted} />
        <Text style={styles.mapPlaceholderText}>Map unavailable</Text>
      </View>
    );
  }
}

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function PlaceOrderScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const stepAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState(0);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [estimate, setEstimate]       = useState(null);
  const [estimating, setEstimating]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo]     = useState(null);

  const [form, setForm] = useState({
    pickupAddress: '', pickupLat: null, pickupLng: null,
    dropoffAddress: '', dropoffLat: null, dropoffLng: null,
    pickupContactName: '', pickupPhone: '',
    recipientName: '', recipientPhone: '',
    pickupNotes: '', dropoffNotes: '',
    packageDescription: '', packageSize: 'medium',
    packagePhotoUrl: null,
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Animate step change
  useEffect(() => {
    Animated.spring(stepAnim, {
      toValue: step,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [step]);

  // Fetch estimate when both coords are set
  useEffect(() => {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = form;
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) return;
    setEstimating(true);
    Promise.all([
      api.post('/orders/estimate', { pickupLat, pickupLng, dropoffLat, dropoffLng }),
      fetchDirections([pickupLng, pickupLat], [dropoffLng, dropoffLat]),
    ]).then(([res, route]) => {
      setEstimate(res.data);
      if (route) {
        setRouteCoords(route.geometry.coordinates);
        setRouteInfo({ distanceKm: (route.distance / 1000).toFixed(1), durationMin: Math.round(route.duration / 60) });
      }
    }).catch(() => {}).finally(() => setEstimating(false));
  }, [form.pickupLat, form.pickupLng, form.dropoffLat, form.dropoffLng]);

  async function useMyLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is needed for GPS pickup.');
      return;
    }
    setGpsLoading(true);
    try {
      const loc  = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setF('pickupLat', lat);
      setF('pickupLng', lng);
      setF('pickupAddress', 'Locatingâ€¦');
      const addr = await geocodeReverse(lng, lat);
      setF('pickupAddress', addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setGpsLoading(false);
    }
  }

  async function pickPackagePhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.6, base64: true,
    });
    if (!result.canceled) {
      setF('packagePhotoUrl', `data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  }

  function goNext() {
    if (step === 0) {
      if (!form.pickupLat || !form.dropoffLat)
        return Alert.alert('Missing locations', 'Please set both pickup and drop-off addresses.');
    }
    if (step === 1) {
      if (!form.pickupContactName || !form.pickupPhone)
        return Alert.alert('Missing info', 'Pickup contact name and phone are required.');
      if (!form.recipientName || !form.recipientPhone)
        return Alert.alert('Missing info', 'Recipient name and phone are required.');
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s + 1);
  }

  function goBack() {
    if (step === 0) navigation.goBack();
    else setStep(s => s - 1);
  }

  async function placeOrder() {
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders', {
        pickupAddress: form.pickupAddress,
        pickupLat: form.pickupLat, pickupLng: form.pickupLng,
        pickupContactName: form.pickupContactName,
        pickupPhone: form.pickupPhone, pickupNotes: form.pickupNotes,
        dropoffAddress: form.dropoffAddress,
        dropoffLat: form.dropoffLat, dropoffLng: form.dropoffLng,
        recipientName: form.recipientName,
        recipientPhone: form.recipientPhone, dropoffNotes: form.dropoffNotes,
        packageDescription: form.packageDescription,
        packageSize: form.packageSize,
        packagePhotoUrl: form.packagePhotoUrl,
      });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('TrackOrder', { orderId: data.id });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to place order. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // â”€â”€ Step 0: Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderLocations() {
    return (
      <View style={{ flex: 1 }}>
        <DeliveryMap
          pickupCoords={form.pickupLng ? [form.pickupLng, form.pickupLat] : null}
          dropoffCoords={form.dropoffLng ? [form.dropoffLng, form.dropoffLat] : null}
          routeCoords={routeCoords}
          style={styles.map}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.bottomSheet}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View style={styles.sheetHandle} />

            <AddressInput
              label="Pickup"
              color={colors.purple}
              value={form.pickupAddress}
              onChange={v => setF('pickupAddress', v)}
              onSelect={({ address, lng, lat }) => {
                setF('pickupAddress', address);
                setF('pickupLat', lat);
                setF('pickupLng', lng);
              }}
              placeholder="Where to collect from?"
              showGPS
              onGPS={useMyLocation}
              gpsLoading={gpsLoading}
            />

            <View style={styles.routeConnector}>
              <View style={styles.connectorLine} />
            </View>

            <AddressInput
              label="Drop-off"
              color={colors.accent}
              value={form.dropoffAddress}
              onChange={v => setF('dropoffAddress', v)}
              onSelect={({ address, lng, lat }) => {
                setF('dropoffAddress', address);
                setF('dropoffLat', lat);
                setF('dropoffLng', lng);
              }}
              placeholder="Where to deliver?"
            />

            {form.pickupLat && form.dropoffLat && (
              <View style={styles.routeSummaryRow}>
                {estimating
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : routeInfo && (
                    <>
                      <View style={styles.routeSummaryChip}>
                        <Ionicons name="map-outline" size={12} color={colors.muted} />
                        <Text style={styles.routeSummaryText}>{routeInfo.distanceKm} km</Text>
                      </View>
                      <View style={styles.routeSummaryChip}>
                        <Ionicons name="time-outline" size={12} color={colors.muted} />
                        <Text style={styles.routeSummaryText}>~{routeInfo.durationMin} min</Text>
                      </View>
                      {estimate && (
                        <View style={[styles.routeSummaryChip, {
                          backgroundColor: estimate.individualSaving > 0 ? colors.success + '18' : colors.primary + '18',
                          borderColor: estimate.individualSaving > 0 ? colors.success + '40' : colors.primary + '30',
                        }]}>
                          {estimate.individualSaving > 0 && (
                            <View style={{ backgroundColor: colors.success, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{estimate.discountPercent}% OFF</Text>
                            </View>
                          )}
                          <Text style={[styles.routeSummaryText, { color: estimate.individualSaving > 0 ? colors.success : colors.accent, fontWeight: '800' }]}>
                            {formatMoney(estimate.estimatedPrice)}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // â”€â”€ Step 1: Details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderDetails() {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.stepScroll]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Pickup contact */}
          <Text style={styles.sectionLabel}>Pickup Contact</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Name</Text>
            <TextInput style={styles.input} value={form.pickupContactName} onChangeText={v => setF('pickupContactName', v)}
              placeholder="Person at pickup" placeholderTextColor={colors.placeholder} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput style={styles.input} value={form.pickupPhone} onChangeText={v => setF('pickupPhone', v)}
              placeholder="+233..." placeholderTextColor={colors.placeholder} keyboardType="phone-pad" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pickup Notes (optional)</Text>
            <TextInput style={styles.input} value={form.pickupNotes} onChangeText={v => setF('pickupNotes', v)}
              placeholder="Ring bell 3 times..." placeholderTextColor={colors.placeholder} />
          </View>

          {/* Recipient */}
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Recipient</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Recipient Name</Text>
            <TextInput style={styles.input} value={form.recipientName} onChangeText={v => setF('recipientName', v)}
              placeholder="Who receives this?" placeholderTextColor={colors.placeholder} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Recipient Phone</Text>
            <TextInput style={styles.input} value={form.recipientPhone} onChangeText={v => setF('recipientPhone', v)}
              placeholder="+233..." placeholderTextColor={colors.placeholder} keyboardType="phone-pad" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Drop-off Notes (optional)</Text>
            <TextInput style={styles.input} value={form.dropoffNotes} onChangeText={v => setF('dropoffNotes', v)}
              placeholder="Leave at front desk..." placeholderTextColor={colors.placeholder} />
          </View>

          {/* Package */}
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Package</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput style={styles.input} value={form.packageDescription} onChangeText={v => setF('packageDescription', v)}
              placeholder="Documents, food, fragile..." placeholderTextColor={colors.placeholder} />
          </View>

          <View style={styles.sizeGrid}>
            {SIZES.map(s => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setF('packageSize', s.id)}
                style={[styles.sizeCard, form.packageSize === s.id && styles.sizeCardActive]}
              >
                <Ionicons name={s.icon} size={22} color={form.packageSize === s.id ? colors.white : colors.muted} />
                <Text style={[styles.sizeLabel, form.packageSize === s.id && { color: colors.white }]}>{s.label}</Text>
                <Text style={[styles.sizeDesc, form.packageSize === s.id && { color: 'rgba(255,255,255,0.7)' }]}>{s.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Package Photo (optional)</Text>
            {form.packagePhotoUrl ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: form.packagePhotoUrl }} style={styles.photoImg} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => setF('packagePhotoUrl', null)}>
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={pickPackagePhoto} style={styles.photoUpload}>
                <Ionicons name="image-outline" size={26} color={colors.muted} />
                <Text style={styles.photoUploadText}>Tap to attach photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // â”€â”€ Step 2: Confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderConfirm() {
    return (
      <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.confirmTitle}>Order Summary</Text>

        {/* Route card */}
        <View style={styles.confirmCard}>
          <View style={styles.confirmRow}>
            <View style={[styles.confirmDot, { backgroundColor: colors.purple }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmRowLabel}>Pickup</Text>
              <Text style={styles.confirmRowValue} numberOfLines={2}>{form.pickupAddress}</Text>
              <Text style={styles.confirmRowSub}>{form.pickupContactName} Â· {form.pickupPhone}</Text>
            </View>
          </View>
          <View style={styles.confirmConnector} />
          <View style={styles.confirmRow}>
            <View style={[styles.confirmDot, { backgroundColor: colors.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmRowLabel}>Drop-off</Text>
              <Text style={styles.confirmRowValue} numberOfLines={2}>{form.dropoffAddress}</Text>
              <Text style={styles.confirmRowSub}>{form.recipientName} Â· {form.recipientPhone}</Text>
            </View>
          </View>
        </View>

        {/* Package card */}
        <View style={styles.confirmCard}>
          <View style={styles.confirmDetailRow}>
            <Ionicons name="cube-outline" size={16} color={colors.muted} />
            <Text style={styles.confirmDetailLabel}>Package</Text>
            <Text style={styles.confirmDetailValue}>
              {form.packageDescription || 'â€”'}{form.packageSize ? ` Â· ${form.packageSize}` : ''}
            </Text>
          </View>
          {form.packagePhotoUrl && (
            <Image source={{ uri: form.packagePhotoUrl }} style={styles.confirmPhoto} />
          )}
        </View>

        {/* Price card */}
        <View style={[styles.confirmCard, {
          borderColor: estimate?.individualSaving > 0 ? colors.success + '40' : colors.primary + '30',
        }]}>
          {estimating
            ? <ActivityIndicator color={colors.primary} />
            : estimate
            ? (
              <>
                <View style={styles.confirmDetailRow}>
                  <Ionicons name="map-outline" size={16} color={colors.muted} />
                  <Text style={styles.confirmDetailLabel}>Distance</Text>
                  <Text style={styles.confirmDetailValue}>{estimate.distanceKm} km</Text>
                </View>
                <View style={[styles.confirmDetailRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 8 }]}>
                  <Ionicons name="wallet-outline" size={16} color={estimate.individualSaving > 0 ? colors.success : colors.accent} />
                  <Text style={[styles.confirmDetailLabel, { color: estimate.individualSaving > 0 ? colors.success : colors.accent }]}>
                    {estimate.individualSaving > 0 ? 'Your Price' : 'Estimated Price'}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    {estimate.individualSaving > 0 && (
                      <Text style={{ color: colors.muted, fontSize: 12, textDecorationLine: 'line-through', marginBottom: 2 }}>
                        {formatMoney(estimate.estimatedPrice + estimate.individualSaving)}
                      </Text>
                    )}
                    <Text style={{ color: estimate.individualSaving > 0 ? colors.success : colors.accent, fontSize: 22, fontWeight: '900' }}>
                      {formatMoney(estimate.estimatedPrice)}
                    </Text>
                  </View>
                </View>
                {estimate.individualSaving > 0 && (
                  <View style={{ marginTop: 8, backgroundColor: colors.success + '14', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ backgroundColor: colors.success, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{estimate.discountPercent}% OFF</Text>
                      </View>
                      <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>Your discount</Text>
                    </View>
                    <Text style={{ color: colors.success, fontWeight: '800', fontSize: 14 }}>
                      -{formatMoney(estimate.individualSaving)} saved
                    </Text>
                  </View>
                )}
              </>
            )
            : <Text style={{ color: colors.muted }}>Price will be calculated after assignment</Text>
          }
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>New Delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((label, i) => {
          const done   = i < step;
          const active = i === step;
          return (
            <React.Fragment key={label}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  done   && styles.stepCircleDone,
                  active && styles.stepCircleActive,
                ]}>
                  {done
                    ? <Ionicons name="checkmark" size={12} color={colors.white} />
                    : <Text style={[styles.stepNum, active && { color: colors.white }]}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, active && { color: colors.text, fontWeight: '700' }]}>
                  {label}
                </Text>
              </View>
              {i < STEPS.length - 1 && (
                <View style={[styles.stepLine, done && styles.stepLineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Step content */}
      <View style={{ flex: 1 }}>
        {step === 0 && renderLocations()}
        {step === 1 && renderDetails()}
        {step === 2 && renderConfirm()}
      </View>

      {/* Bottom CTA */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 12 }]}>
        {step < 2 ? (
          <TouchableOpacity onPress={goNext} style={styles.nextBtnWrap}>
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.nextBtn}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={placeOrder} disabled={submitting} style={[styles.nextBtnWrap, submitting && { opacity: 0.7 }]}>
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.nextBtn}
            >
              {submitting
                ? <ActivityIndicator color={colors.white} />
                : <>
                    <Ionicons name="cube" size={18} color={colors.white} />
                    <Text style={styles.nextBtnText}>Place Order</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const MAP_H = height * 0.42;

const createStyles = (colors) => StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '800', color: colors.text },

  stepBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stepItem:  { alignItems: 'center', gap: 4 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stepCircleActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepCircleDone: { borderColor: colors.success, backgroundColor: colors.success },
  stepNum:   { fontSize: 11, fontWeight: '800', color: colors.muted },
  stepLabel: { fontSize: 10, fontWeight: '600', color: colors.muted },
  stepLine:  { flex: 1, height: 2, backgroundColor: colors.borderLight, marginHorizontal: 4, marginBottom: 14 },
  stepLineDone: { backgroundColor: colors.success },

  // Map
  map: { height: MAP_H },
  mapPlaceholder: { height: MAP_H, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, gap: 8 },
  mapPlaceholderText: { color: colors.muted, fontSize: 13 },
  mapPin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, ...shadow.md },

  // Bottom sheet (step 0)
  bottomSheet: {
    flex: 1, backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
    paddingHorizontal: 16, paddingTop: 8,
    marginTop: -20,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, alignSelf: 'center', marginBottom: 16 },

  // Address input
  addressGroup:   { marginBottom: 8 },
  addressLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  addressDot:     { width: 10, height: 10, borderRadius: 5 },
  addressLabel:   { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  addressInputRow:{ flexDirection: 'row', gap: 8 },
  addressInput:   { flex: 1, height: 46, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 14, color: colors.text, fontSize: 14 },
  gpsBtn:         { width: 46, height: 46, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  suggestions: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginTop: 4, overflow: 'hidden',
  },
  suggestion: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'flex-start' },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggMain: { fontSize: 13, fontWeight: '700', color: colors.text },
  suggSub:  { fontSize: 11, color: colors.muted, marginTop: 1 },

  routeConnector: { height: 16, paddingLeft: 4, justifyContent: 'center' },
  connectorLine:  { width: 2, height: '100%', backgroundColor: colors.borderLight, marginLeft: 3 },

  routeSummaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  routeSummaryChip: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  routeSummaryText: { fontSize: 11, fontWeight: '600', color: colors.muted },

  // Steps 1 & 2
  stepScroll: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  inputGroup:   { marginBottom: 14 },
  inputLabel:   { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { height: 46, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, color: colors.text, fontSize: 14 },

  sizeGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  sizeCard: {
    flex: 1, borderRadius: radius.md, padding: 12, alignItems: 'center', gap: 4,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.borderLight,
  },
  sizeCardActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.brand },
  sizeLabel: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  sizeDesc:  { fontSize: 10, color: colors.muted, textAlign: 'center' },

  photoUpload: {
    height: 80, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: colors.borderLight, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  photoUploadText: { fontSize: 13, color: colors.muted },
  photoPreview: { position: 'relative' },
  photoImg:    { width: '100%', height: 160, borderRadius: radius.md, backgroundColor: colors.card },
  photoRemove: { position: 'absolute', top: 8, right: 8 },

  // Confirm
  confirmTitle:  { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 16 },
  confirmCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 12,
  },
  confirmRow:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  confirmDot:  { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
  confirmConnector: { width: 2, height: 20, backgroundColor: colors.borderLight, marginLeft: 5, marginVertical: 4 },
  confirmRowLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmRowValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  confirmRowSub:   { fontSize: 11, color: colors.muted, marginTop: 2 },
  confirmDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirmDetailLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
  confirmDetailValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  confirmPhoto: { width: '100%', height: 120, borderRadius: radius.md, marginTop: 10 },

  // Bottom CTA
  bottomCTA: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  nextBtnWrap:  { borderRadius: radius.md, overflow: 'hidden', ...shadow.brand },
  nextBtn:      { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextBtnText:  { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});

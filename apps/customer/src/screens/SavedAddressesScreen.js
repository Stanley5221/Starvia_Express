import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { colors, radius, shadow } from '../constants/theme';

const LABEL_ICONS = { home: 'home', work: 'briefcase', other: 'location' };
const LABELS = ['home', 'work', 'other'];

export default function SavedAddressesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ label: 'home', address: '', lat: '', lng: '' });

  const fetchAddresses = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me/addresses');
      setAddresses(data);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAddresses(); }, []);

  async function addAddress() {
    const { label, address, lat, lng } = form;
    if (!address.trim() || !lat || !lng)
      return Alert.alert('Missing fields', 'Please enter the address and coordinates.');
    setSaving(true);
    try {
      const { data } = await api.post('/users/me/addresses', {
        label, address: address.trim(),
        lat: parseFloat(lat), lng: parseFloat(lng),
      });
      setAddresses(a => [...a, data]);
      setShowForm(false);
      setForm({ label: 'home', address: '', lat: '', lng: '' });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not save address.');
    } finally { setSaving(false); }
  }

  async function deleteAddress(id) {
    Alert.alert('Delete Address', 'Remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/users/me/addresses/${id}`);
          setAddresses(a => a.filter(x => x.id !== id));
        } catch (_) {
          Alert.alert('Error', 'Could not delete address.');
        }
      }},
    ]);
  }

  function renderItem({ item }) {
    const icon = LABEL_ICONS[item.label] ?? 'location';
    return (
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>{item.label.charAt(0).toUpperCase() + item.label.slice(1)}</Text>
          <Text style={styles.cardAddress} numberOfLines={2}>{item.address}</Text>
          <Text style={styles.cardCoords}>{Number(item.lat).toFixed(5)}, {Number(item.lng).toFixed(5)}</Text>
        </View>
        <TouchableOpacity onPress={() => deleteAddress(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <TouchableOpacity onPress={() => setShowForm(s => !s)} style={styles.addBtn}>
          <Ionicons name={showForm ? 'close' : 'add'} size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAddresses(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Add form */}
          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Add New Address</Text>

              <Text style={styles.label}>Label</Text>
              <View style={styles.labelRow}>
                {LABELS.map(l => (
                  <TouchableOpacity
                    key={l} style={[styles.labelChip, form.label === l && styles.labelChipActive]}
                    onPress={() => setForm(f => ({ ...f, label: l }))}
                  >
                    <Ionicons name={LABEL_ICONS[l]} size={14} color={form.label === l ? colors.white : colors.muted} />
                    <Text style={[styles.labelChipText, form.label === l && { color: colors.white }]}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.textInput}
                value={form.address}
                onChangeText={v => setForm(f => ({ ...f, address: v }))}
                placeholder="e.g. 12 Accra Road, East Legon"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="sentences"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={form.lat}
                    onChangeText={v => setForm(f => ({ ...f, lat: v }))}
                    placeholder="5.6037"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={form.lng}
                    onChangeText={v => setForm(f => ({ ...f, lng: v }))}
                    placeholder="-0.1870"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity onPress={addAddress} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Address</Text>}
              </TouchableOpacity>
            </View>
          )}

          {addresses.map(item => renderItem({ item }))}

          {addresses.length === 0 && !showForm && (
            <View style={styles.center}>
              <Ionicons name="location-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 12, fontSize: 15 }}>No saved addresses</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Tap + to add one</Text>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.sm,
  },
  cardIcon:    { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  cardLabel:   { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 3 },
  cardAddress: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  cardCoords:  { fontSize: 11, color: colors.muted, marginTop: 4 },
  deleteBtn:   { padding: 6 },

  formCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.sm,
  },
  formTitle:    { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 14 },
  label:        { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelRow:     { flexDirection: 'row', gap: 8, marginBottom: 14 },
  labelChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderLight },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText:   { fontSize: 13, color: colors.muted, fontWeight: '600' },
  textInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight,
    paddingHorizontal: 12, height: 46, color: colors.text, fontSize: 14, marginBottom: 12,
  },
  saveBtn:     { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4, ...shadow.brand },
  saveBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});

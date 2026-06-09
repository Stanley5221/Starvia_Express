import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow } from '../constants/theme';

const STATUS_COLORS_MAP = {
  APPROVED:     colors.success,
  PENDING:      colors.warning,
  UNDER_REVIEW: colors.info,
  REJECTED:     colors.danger,
  SUSPENDED:    colors.danger,
};

function ReadField({ label, value }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.readRow}>
        <Text style={styles.readValue}>{value ?? '—'}</Text>
        <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
      </View>
    </View>
  );
}

export default function BusinessProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ phone: '', businessAddress: '', gpsAddress: '' });

  useEffect(() => {
    api.get('/business/profile').then(({ data }) => {
      setProfile(data);
      setForm({ phone: data.phone ?? '', businessAddress: data.businessAddress ?? '', gpsAddress: data.gpsAddress ?? '' });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    if (!form.phone.trim() || !form.businessAddress.trim())
      return Alert.alert('Required fields', 'Phone and business address are required.');
    setSaving(true);
    try {
      const { data } = await api.patch('/business/profile', {
        phone: form.phone.trim(),
        businessAddress: form.businessAddress.trim(),
        gpsAddress: form.gpsAddress.trim() || undefined,
      });
      setProfile(p => ({ ...p, ...data }));
      await refreshUser();
      setEditing(false);
      Alert.alert('Saved', 'Business profile updated.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not save profile.');
    } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  const statusColor = STATUS_COLORS_MAP[profile?.verificationStatus] ?? colors.muted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Profile</Text>
        <TouchableOpacity onPress={() => editing ? saveProfile() : setEditing(true)} style={styles.editBtn} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={styles.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {(profile?.verificationStatus ?? 'PENDING').replace(/_/g, ' ')}
          </Text>
        </View>

        {/* Read-only fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          <View style={styles.card}>
            <ReadField label="Business Name"  value={profile?.businessName} />
            <ReadField label="Business Type"  value={profile?.businessType?.replace(/_/g, ' ')} />
            <ReadField label="Owner Name"     value={profile?.ownerFullName} />
            <ReadField label="Email"          value={profile?.email} />
          </View>
        </View>

        {/* Editable fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact & Location</Text>
          <View style={styles.card}>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Phone</Text>
              {editing ? (
                <TextInput
                  style={styles.textInput}
                  value={form.phone}
                  onChangeText={v => setForm(f => ({ ...f, phone: v }))}
                  placeholder="+233 24 000 0000"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="phone-pad"
                />
              ) : <Text style={styles.readValue}>{profile?.phone ?? '—'}</Text>}
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Business Address</Text>
              {editing ? (
                <TextInput
                  style={styles.textInput}
                  value={form.businessAddress}
                  onChangeText={v => setForm(f => ({ ...f, businessAddress: v }))}
                  placeholder="Street address"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="sentences"
                  multiline
                />
              ) : <Text style={styles.readValue}>{profile?.businessAddress ?? '—'}</Text>}
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>GPS Address (optional)</Text>
              {editing ? (
                <TextInput
                  style={styles.textInput}
                  value={form.gpsAddress}
                  onChangeText={v => setForm(f => ({ ...f, gpsAddress: v }))}
                  placeholder="GA-123-4567"
                  placeholderTextColor={colors.placeholder}
                />
              ) : <Text style={styles.readValue}>{profile?.gpsAddress ?? '—'}</Text>}
            </View>
          </View>
        </View>

        {editing && (
          <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  editBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  editBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },

  section:      { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12, ...shadow.sm,
  },
  fieldWrap:  { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  readRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readValue:  { fontSize: 14, color: colors.text, fontWeight: '500' },
  textInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight,
    paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontSize: 14, minHeight: 46,
  },
  cancelBtn: {
    borderWidth: 1, borderColor: colors.muted, borderRadius: radius.md,
    paddingVertical: 13, alignItems: 'center',
  },
  cancelBtnText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
});

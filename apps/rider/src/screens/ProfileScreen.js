import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Image, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, SafeAreaView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../constants/theme';
import { formatGHS } from '../constants/currency';

function licenceBadge(expiry, colors) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0)   return { text: 'EXPIRED',               color: colors.danger };
  if (days <= 30) return { text: `Expires in ${days}d`,   color: colors.warning };
  return            { text: `Valid Â· ${new Date(expiry).toLocaleDateString('en-GH')}`, color: colors.success };
}

function toDateInput(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().split('T')[0];
}

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { rider, logout, refreshProfile } = useAuth();
  const [profile, setProfile]   = useState(rider);
  const [uploading, setUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [pwVisible, setPwVisible] = useState(false);
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw]     = useState({ current: false, next: false, confirm: false });

  useEffect(() => { load(); }, []);

  async function load() {
    try { const { data } = await api.get('/riders/me'); setProfile(data); } catch (_) {}
  }

  function openEditModal() {
    const p = profile || rider;
    setEditForm({
      fullName:      p?.fullName      || '',
      phone:         p?.phone         || '',
      motorPlate:    p?.motorPlate    || '',
      motorMake:     p?.motorMake     || '',
      motorModel:    p?.motorModel    || '',
      motorColor:    p?.motorColor    || '',
      licenceNumber: p?.licenceNumber || '',
      licenceExpiry: toDateInput(p?.licenceExpiry),
    });
    setEditVisible(true);
  }

  async function saveProfile() {
    if (!editForm.fullName.trim()) return Alert.alert('Required', 'Full name cannot be empty.');
    setSaving(true);
    try {
      await api.patch('/riders/me', editForm);
      await load(); await refreshProfile();
      setEditVisible(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not save profile.');
    } finally { setSaving(false); }
  }

  async function changePassword() {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) return Alert.alert('Missing fields', 'Please fill in all password fields.');
    if (pwForm.next.length < 8) return Alert.alert('Too short', 'New password must be at least 8 characters.');
    if (pwForm.next !== pwForm.confirm) return Alert.alert('Mismatch', 'Passwords do not match.');
    setSaving(true);
    try {
      await api.post('/users/me/password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwVisible(false); setPwForm({ current: '', next: '', confirm: '' });
      Alert.alert('Done', 'Password changed successfully.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not change password.');
    } finally { setSaving(false); }
  }

  async function uploadProfilePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photos', 'Photo library permission required.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      await api.patch('/riders/me', { profilePhoto: `data:image/jpeg;base64,${result.assets[0].base64}` });
      await load(); await refreshProfile();
      Alert.alert('Updated', 'Profile photo saved.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not upload photo.');
    } finally { setUploading(false); }
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Sign out of Starvia Rider?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        setLoggingOut(true);
        try { await logout(); } catch (_) { setLoggingOut(false); }
      }},
    ]);
  }

  const p = profile || rider;
  if (!p) return null;

  const initials  = p.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'RD';
  const lic       = licenceBadge(p.licenceExpiry, colors);
  const riderId   = p.riderId || `RD-${p.id?.slice(-5)?.toUpperCase() || '-----'}`;

  return (
    <>
      {/* â”€â”€ Edit Profile Modal â”€â”€ */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={saveProfile} disabled={saving} style={styles.modalSaveBtn}>
                {saving ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <SectionLabel>PERSONAL</SectionLabel>
              <ModalField label="Full name"     value={editForm.fullName}     onChangeText={v => setEditForm(f => ({ ...f, fullName: v }))} />
              <ModalField label="Phone number"  value={editForm.phone}        onChangeText={v => setEditForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />

              <SectionLabel>MOTOR DETAILS</SectionLabel>
              <ModalField label="Number plate"    value={editForm.motorPlate}  onChangeText={v => setEditForm(f => ({ ...f, motorPlate: v }))} autoCapitalize="characters" />
              <ModalField label="Make (e.g. Yamaha)"  value={editForm.motorMake}   onChangeText={v => setEditForm(f => ({ ...f, motorMake: v }))} />
              <ModalField label="Model (e.g. YBR 125)" value={editForm.motorModel}  onChangeText={v => setEditForm(f => ({ ...f, motorModel: v }))} />
              <ModalField label="Colour"          value={editForm.motorColor}  onChangeText={v => setEditForm(f => ({ ...f, motorColor: v }))} />

              <SectionLabel>LICENCE</SectionLabel>
              <ModalField label="Licence number"       value={editForm.licenceNumber} onChangeText={v => setEditForm(f => ({ ...f, licenceNumber: v }))} autoCapitalize="characters" />
              <ModalField label="Expiry (YYYY-MM-DD)"  value={editForm.licenceExpiry} onChangeText={v => setEditForm(f => ({ ...f, licenceExpiry: v }))} placeholder="2027-12-31" keyboardType="numbers-and-punctuation" />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* â”€â”€ Change Password Modal â”€â”€ */}
      <Modal visible={pwVisible} animationType="slide" onRequestClose={() => setPwVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPwVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={changePassword} disabled={saving} style={styles.modalSaveBtn}>
                {saving ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {(['current', 'next', 'confirm']).map(key => (
                <ModalField
                  key={key}
                  label={key === 'current' ? 'Current password' : key === 'next' ? 'New password (min. 8 chars)' : 'Confirm new password'}
                  value={pwForm[key]}
                  onChangeText={v => setPwForm(f => ({ ...f, [key]: v }))}
                  secureTextEntry={!showPw[key]}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPw(s => ({ ...s, [key]: !s[key] }))} style={{ padding: 4 }}>
                      <Ionicons name={showPw[key] ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                    </TouchableOpacity>
                  }
                />
              ))}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* â”€â”€ Main Profile â”€â”€ */}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header gradient */}
        <LinearGradient
          colors={[colors.primary + '40', colors.primary + '15', colors.bg]}
          style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
        >
          {/* Avatar */}
          <TouchableOpacity onPress={uploadProfilePhoto} disabled={uploading} style={styles.avatarWrap}>
            {p.profilePhoto ? (
              <Image source={{ uri: p.profilePhoto.startsWith('http') || p.profilePhoto.startsWith('data:') ? p.profilePhoto : `${process.env.EXPO_PUBLIC_API_URL}${p.profilePhoto}` }} style={styles.avatarImg} />
            ) : (
              <LinearGradient colors={[colors.primaryLight, colors.primaryDark]} style={styles.avatarImg}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
            <View style={styles.cameraBtn}>
              {uploading
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Ionicons name="camera" size={14} color={colors.white} />}
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{p.fullName}</Text>
          <Text style={styles.profileId}>{riderId}</Text>

          <View style={[styles.onlinePill, { borderColor: p.isAvailable ? colors.success + '50' : colors.border, backgroundColor: p.isAvailable ? colors.success + '18' : colors.surface }]}>
            <View style={[styles.onlineDot, { backgroundColor: p.isAvailable ? colors.success : colors.muted }]} />
            <Text style={[styles.onlineText, { color: p.isAvailable ? colors.success : colors.muted }]}>
              {p.isAvailable ? 'Online' : 'Offline'}
            </Text>
          </View>
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{p.totalDeliveries ?? 0}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{p.averageRating ? p.averageRating.toFixed(1) : 'â€”'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{formatGHS(p.totalEarnings ?? 0)}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* Personal info */}
          <Text style={styles.sectionTitle}>PERSONAL</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="call-outline"           label="Phone"   value={p.phone || p.user?.phone} />
            <InfoRow icon="mail-outline"            label="Email"   value={p.user?.email} last />
          </View>

          {/* Motor details */}
          <Text style={styles.sectionTitle}>MOTOR</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="bicycle-outline" label="Plate"  value={p.motorPlate} />
            <InfoRow icon="car-outline"     label="Bike"   value={[p.motorMake, p.motorModel, p.motorColor].filter(Boolean).join(' Â· ')} />
            <InfoRow
              icon="card-outline"
              label="Licence"
              value={p.licenceNumber}
              badge={lic ? <View style={[styles.badge, { backgroundColor: lic.color + '22', borderColor: lic.color + '50' }]}><Text style={[styles.badgeText, { color: lic.color }]}>{lic.text}</Text></View> : null}
              last
            />
          </View>

          {/* Account */}
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon="shield-checkmark-outline"
              label="Status"
              value={p.isApproved ? 'Approved' : 'Pending approval'}
              badge={
                <View style={[styles.badge, { backgroundColor: (p.isApproved ? colors.success : colors.warning) + '22', borderColor: (p.isApproved ? colors.success : colors.warning) + '50' }]}>
                  <Text style={[styles.badgeText, { color: p.isApproved ? colors.success : colors.warning }]}>{p.isApproved ? 'Approved' : 'Pending'}</Text>
                </View>
              }
              last
            />
          </View>

          {/* Action buttons */}
          <ActionBtn icon="create-outline" label="Edit Profile" onPress={openEditModal} />
          <ActionBtn icon="lock-closed-outline" label="Change Password" onPress={() => setPwVisible(true)} />

          {/* Theme toggle */}
          <TouchableOpacity onPress={toggleTheme} style={styles.actionBtn} activeOpacity={0.75}>
            <View style={styles.actionIconWrap}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.accent} />
            </View>
            <Text style={styles.actionLabel}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity onPress={handleLogout} disabled={loggingOut} style={styles.logoutBtn}>
            {loggingOut
              ? <ActivityIndicator color={colors.danger} />
              : <>
                  <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                  <Text style={styles.logoutText}>Sign Out</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

function SectionLabel({ children }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <Text style={styles.formSectionLabel}>{children}</Text>;
}

function InfoRow({ icon, label, value, badge, last }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'â€”'}</Text>
      </View>
      {badge}
    </View>
  );
}

function ActionBtn({ icon, label, onPress }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <TouchableOpacity onPress={onPress} style={styles.actionBtn} activeOpacity={0.75}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

function ModalField({ label, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, placeholder, rightIcon }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={[styles.fieldInput, { flex: 1 }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'sentences'}
          placeholder={placeholder || ''}
          placeholderTextColor={colors.placeholder}
        />
        {rightIcon}
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  // Header
  headerGradient: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 20 },

  avatarWrap: { marginBottom: 12, position: 'relative' },
  avatarImg:  { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.primary + '60' },
  avatarInitials: { color: colors.white, fontSize: 32, fontWeight: '900' },
  cameraBtn: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },

  profileName: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 4 },
  profileId:   { fontSize: 12, color: colors.muted, marginBottom: 12 },
  onlinePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  onlineDot:   { width: 7, height: 7, borderRadius: 3.5 },
  onlineText:  { fontSize: 12, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', ...shadow.sm },
  statVal:  { fontSize: 18, fontWeight: '900', color: colors.accent },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 3 },

  // Info cards
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, marginBottom: 8 },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 20, ...shadow.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

  badge:     { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },

  // Action buttons
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10, ...shadow.sm },
  actionIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + '22', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 15 },

  // Logout
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8, padding: 16, borderWidth: 1, borderColor: colors.danger + '35', borderRadius: radius.xl, backgroundColor: colors.danger + '0d' },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },

  // Modals
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalClose: { padding: 4 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  modalSaveBtn: { padding: 4, minWidth: 50, alignItems: 'flex-end' },
  modalSaveText: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 56 },
  formSectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 20, marginBottom: 10 },

  fieldWrap:  { marginBottom: 14 },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  fieldRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 },
  fieldInput: { paddingVertical: 14, color: colors.text, fontSize: 15 },
});

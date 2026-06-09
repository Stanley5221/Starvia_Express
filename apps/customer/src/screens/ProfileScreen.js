import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Platform, ActivityIndicator, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow } from '../constants/theme';
import { formatMoney } from '../constants/currency';

function MenuItem({ icon, label, value, onPress, danger, rightEl }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.menuItem} activeOpacity={0.7}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.danger + '18' }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
        {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      </View>
      {rightEl || <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, updateProfile, logout, refreshUser, isBusiness } = useAuth();
  const insets = useSafeAreaInsets();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
    });
    if (!result.canceled) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      try {
        await updateProfile({ profilePhoto: base64 });
        if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
    }
  }

  async function saveProfile() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
      setEditMode(false);
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (Platform.OS !== 'web') {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);
    } else {
      await logout();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Header gradient ── */}
        <LinearGradient
          colors={[colors.primary + '40', colors.surface, colors.bg]}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <Text style={styles.headerTitle}>Profile</Text>

          {/* Avatar */}
          <TouchableOpacity onPress={pickPhoto} style={styles.avatarWrap} activeOpacity={0.8}>
            <View style={styles.avatarRing}>
              {user?.profilePhoto ? (
                <Image source={{ uri: user.profilePhoto }} style={styles.avatarImg} />
              ) : (
                <LinearGradient
                  colors={[colors.primaryLight, colors.primaryDark]}
                  style={styles.avatarImg}
                >
                  <Text style={styles.avatarInitial}>
                    {user?.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.cameraBtn}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </LinearGradient>

        <View style={styles.body}>
          {/* ── Edit Profile ── */}
          <Section title="Account">
            {editMode ? (
              <View style={styles.editForm}>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={set('name')}
                    placeholderTextColor={colors.placeholder}
                    placeholder="Your name"
                  />
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={form.phone}
                    onChangeText={set('phone')}
                    placeholderTextColor={colors.placeholder}
                    placeholder="+233..."
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setEditMode(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveProfile} disabled={saving} style={styles.saveBtn}>
                    {saving
                      ? <ActivityIndicator color={colors.white} size="small" />
                      : <Text style={styles.saveText}>Save Changes</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <MenuItem icon="person-outline"  label="Full Name" value={user?.name}  onPress={() => setEditMode(true)} />
                <MenuItem icon="mail-outline"    label="Email"     value={user?.email} onPress={() => {}} />
                <MenuItem icon="call-outline"    label="Phone"     value={user?.phone || 'Not set'} onPress={() => setEditMode(true)} />
              </>
            )}
          </Section>

          {/* ── Security ── */}
          <Section title="Security">
            <MenuItem
              icon="lock-closed-outline"
              label="Change Password"
              onPress={() => navigation.navigate('ChangePassword')}
            />
            <MenuItem
              icon="location-outline"
              label="Saved Addresses"
              onPress={() => navigation.navigate('SavedAddresses')}
            />
          </Section>

          {/* ── Business ── */}
          {isBusiness && (
            <Section title="Business Account">
              <MenuItem
                icon="business-outline"
                label="Business Dashboard"
                onPress={() => navigation.navigate('BusinessDashboard')}
              />
              <MenuItem
                icon="document-text-outline"
                label="KYC Documents"
                onPress={() => navigation.navigate('BusinessDocuments')}
              />
              <MenuItem
                icon="briefcase-outline"
                label="Business Profile"
                onPress={() => navigation.navigate('BusinessProfile')}
              />
              <MenuItem
                icon="receipt-outline"
                label="Business Orders"
                onPress={() => navigation.navigate('BusinessOrders')}
              />
            </Section>
          )}

          {/* ── Preferences ── */}
          <Section title="Preferences">
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => navigation.navigate('Notifications')}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Privacy & Security"
              onPress={() => {}}
            />
            <MenuItem
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() => {}}
            />
            <MenuItem
              icon="star-outline"
              label="Rate the App"
              onPress={() => {}}
            />
          </Section>

          {/* ── Danger zone ── */}
          <Section>
            <MenuItem
              icon="log-out-outline"
              label="Sign Out"
              onPress={handleLogout}
              danger
              rightEl={<Ionicons name="arrow-forward" size={16} color={colors.danger} />}
            />
          </Section>

          <Text style={styles.version}>Starvia Express v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 24 },
  headerTitle: { alignSelf: 'flex-start', fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 20 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: colors.primary,
    overflow: 'hidden', ...shadow.brand,
  },
  avatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: colors.white },
  cameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  userName:  { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 3 },
  userEmail: { fontSize: 13, color: colors.muted },

  body: { paddingHorizontal: 20, paddingTop: 8 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  menuValue: { fontSize: 12, color: colors.muted, marginTop: 2 },

  toggleOn: { backgroundColor: colors.success + '25', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: colors.success + '40' },
  toggleText: { fontSize: 11, fontWeight: '700', color: colors.success },

  editForm: { padding: 16, gap: 12 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, height: 44, color: colors.text, fontSize: 15 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '700' },
  saveBtn:  { flex: 2, paddingVertical: 11, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontWeight: '800' },

  version: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 8 },
});

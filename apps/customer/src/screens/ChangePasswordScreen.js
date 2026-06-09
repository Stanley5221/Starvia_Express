import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../constants/theme';

function PasswordField({ label, value, onChange, placeholder, colors, styles }) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={!show}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow(s => !s)} style={{ padding: 4 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit() {
    if (!current || !next) return Alert.alert('Missing fields', 'Please fill in both fields.');
    if (next.length < 8) return Alert.alert('Too short', 'New password must be at least 8 characters.');
    setLoading(true);
    try {
      await api.post('/users/me/password', { currentPassword: current, newPassword: next });
      Alert.alert('Success', 'Your password has been updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      setCurrent(''); setNext('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not update password.');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.title}>Change Password</Text>
        <Text style={styles.subtitle}>Choose a strong password to secure your account</Text>

        <View style={styles.card}>
          <PasswordField label="Current Password" value={current} onChange={setCurrent} placeholder="Enter current password" colors={colors} styles={styles} />
          <PasswordField label="New Password" value={next} onChange={setNext} placeholder="Min. 8 characters" colors={colors} styles={styles} />

          <TouchableOpacity onPress={handleSubmit} disabled={loading} style={[styles.btn, loading && { opacity: 0.7 }]}>
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.btnText}>Update Password</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  scroll:   { flexGrow: 1, paddingHorizontal: 24 },
  backBtn:  { marginBottom: 16 },
  title:    { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 28 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: 24, ...shadow.md,
  },
  fieldWrap: { marginBottom: 16 },
  label:     { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 12 },
  input:     { height: 48, color: colors.text, fontSize: 15 },
  btn: {
    marginTop: 8, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', ...shadow.brand,
  },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});

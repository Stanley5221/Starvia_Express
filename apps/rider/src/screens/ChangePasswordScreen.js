import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { colors } from '../constants/theme';

export default function ChangePasswordScreen() {
  const { user, logout, markPasswordChanged } = useAuth();
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleChange() {
    setError('');
    if (!current || !next || !confirm) {
      return setError('Please fill in all fields.');
    }
    if (next.length < 8) {
      return setError('New password must be at least 8 characters.');
    }
    if (next !== confirm) {
      return setError('New password and confirmation do not match.');
    }

    setLoading(true);
    try {
      await api.post('/users/me/password', {
        currentPassword: current,
        newPassword:     next,
      });
      // Update local state — AppNavigator will transition to main tabs automatically
      await markPasswordChanged();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🔐</Text>
      </View>
      <Text style={styles.title}>Set Your Password</Text>
      <Text style={styles.sub}>
        Welcome, <Text style={styles.accent}>{user?.name?.split(' ')[0]}</Text>!{'\n'}
        Your account was created by Starvia admin.{'\n'}
        Please set a personal password before you start.
      </Text>

      {/* Fields */}
      <Text style={styles.label}>Temporary Password (given by admin)</Text>
      <TextInput
        style={styles.input}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        placeholderTextColor={colors.muted}
        placeholder="Enter the temp password"
      />

      <Text style={styles.label}>New Password</Text>
      <TextInput
        style={styles.input}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        placeholderTextColor={colors.muted}
        placeholder="Min. 8 characters"
      />

      <Text style={styles.label}>Confirm New Password</Text>
      <TextInput
        style={styles.input}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        placeholderTextColor={colors.muted}
        placeholder="Repeat new password"
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.btn} onPress={handleChange} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={styles.btnText}>Set Password & Continue</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={logout} style={{ marginTop: 20 }}>
        <Text style={styles.logoutLink}>Log out and sign in later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: 28,
  },
  iconWrap:  { alignItems: 'center', marginBottom: 12 },
  icon:      { fontSize: 56 },
  title:     { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  accent:    { color: colors.primary },
  sub: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 32,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#E24B4A',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(226,75,74,0.1)',
    borderRadius: 8,
    padding: 10,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(45,212,160,0.3)' } : {}),
  },
  btnText:    { color: colors.bg, fontSize: 17, fontWeight: '800' },
  logoutLink: { color: colors.muted, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
});

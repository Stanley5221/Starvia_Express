import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export default function AwaitingApprovalScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Awaiting approval</Text>
      <Text style={styles.sub}>
        Your rider application is being reviewed. You will be notified once an admin approves your account.
      </Text>
      <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 32, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  sub: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  logoutBtn: { marginTop: 32, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 99, borderWidth: 1, borderColor: colors.muted },
  logoutText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
});

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Animated, Platform, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow } from '../constants/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { login }  = useAuth();
  const insets     = useSafeAreaInsets();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const pwRef  = useRef(null);
  const shake  = useRef(new Animated.Value(0)).current;

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields.'); triggerShake(); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/logo-white.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Rider Portal</Text>
        </View>

        {/* Card */}
        <Animated.View style={[styles.card, { transform: [{ translateX: shake }] }]}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to start earning</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="rider@starvia.com"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => pwRef.current?.focus()}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                ref={pwRef}
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.btnWrap, loading && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <>
                    <Text style={styles.btnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.white} />
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.footer}>Starvia Express · Rider App</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logo:     { width: 200, height: 72 },
  tagline:  { fontSize: 13, color: colors.muted, marginTop: 6, letterSpacing: 2, textTransform: 'uppercase' },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    ...shadow.md,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: colors.muted, marginBottom: 20 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '18', borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.danger + '40', padding: 10, marginBottom: 16,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13 },

  fieldWrap: { marginBottom: 16 },
  label:     { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 12 },
  input:     { flex: 1, height: 48, color: colors.text, fontSize: 15 },

  btnWrap: { marginTop: 8, borderRadius: radius.md, overflow: 'hidden', ...shadow.brand },
  btn:     { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  footer: { textAlign: 'center', color: colors.placeholder, fontSize: 12, marginTop: 32 },
});

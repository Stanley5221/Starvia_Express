import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow } from '../constants/theme';

const BUSINESS_TYPES = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'SUPERMARKET', label: 'Supermarket' },
  { value: 'ONLINE_SHOP', label: 'Online Shop' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'OTHER', label: 'Other' },
];

function Field({ label, icon, value, onChangeText, placeholder, keyboard = 'default', secure = false, autoCapitalize = 'none', inputRef, onSubmitEditing, returnKeyType = 'next' }) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={18} color={colors.muted} style={styles.inputIcon} />
        <TextInput
          ref={inputRef}
          style={[styles.input, { flex: 1 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboard}
          secureTextEntry={secure && !show}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function BusinessTypeSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = BUSINESS_TYPES.find(t => t.value === value);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>Business Type</Text>
      <TouchableOpacity style={styles.inputRow} onPress={() => setOpen(o => !o)}>
        <Ionicons name="business-outline" size={18} color={colors.muted} style={styles.inputIcon} />
        <Text style={[styles.input, { flex: 1, lineHeight: 48, color: selected ? colors.text : colors.placeholder }]}>
          {selected ? selected.label : 'Select business type'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          {BUSINESS_TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.dropdownItem, t.value === value && styles.dropdownItemActive]}
              onPress={() => { onChange(t.value); setOpen(false); }}
            >
              <Text style={[styles.dropdownText, t.value === value && { color: colors.primary }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const insets  = useSafeAreaInsets();
  const [type, setType]       = useState('INDIVIDUAL'); // 'INDIVIDUAL' | 'BUSINESS'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Individual fields
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');

  // Business-only fields
  const [bizName, setBizName]         = useState('');
  const [bizType, setBizType]         = useState('');
  const [ownerName, setOwnerName]     = useState('');
  const [bizEmail, setBizEmail]       = useState('');
  const [bizPhone, setBizPhone]       = useState('');
  const [bizAddress, setBizAddress]   = useState('');
  const [gpsAddress, setGpsAddress]   = useState('');
  const [bizPassword, setBizPassword] = useState('');
  const [bizConfirm, setBizConfirm]   = useState('');

  async function handleRegister() {
    setError('');
    if (type === 'INDIVIDUAL') {
      if (!name.trim() || !email.trim() || !phone.trim() || !password)
        return setError('Please fill in all fields.');
      if (password.length < 8)
        return setError('Password must be at least 8 characters.');
      if (password !== confirm)
        return setError('Passwords do not match.');
      setLoading(true);
      try {
        await register({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, accountType: 'INDIVIDUAL' });
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Registration failed');
      } finally { setLoading(false); }
    } else {
      if (!bizName.trim() || !bizType || !ownerName.trim() || !bizEmail.trim() || !bizPhone.trim() || !bizAddress.trim() || !bizPassword)
        return setError('Please fill in all required fields.');
      if (bizPassword.length < 8)
        return setError('Password must be at least 8 characters.');
      if (bizPassword !== bizConfirm)
        return setError('Passwords do not match.');
      setLoading(true);
      try {
        await register({
          name: ownerName.trim(),
          email: bizEmail.trim().toLowerCase(),
          phone: bizPhone.trim(),
          password: bizPassword,
          accountType: 'BUSINESS',
          businessName: bizName.trim(),
          businessType: bizType,
          ownerFullName: ownerName.trim(),
          businessAddress: bizAddress.trim(),
          gpsAddress: gpsAddress.trim() || undefined,
        });
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Registration failed');
      } finally { setLoading(false); }
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 48 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join Starvia Express</Text>

        {/* Account type toggle */}
        <View style={styles.toggle}>
          {['INDIVIDUAL', 'BUSINESS'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.toggleBtn, type === t && styles.toggleBtnActive]}
              onPress={() => { setType(t); setError(''); }}
            >
              <Ionicons
                name={t === 'INDIVIDUAL' ? 'person-outline' : 'business-outline'}
                size={15}
                color={type === t ? colors.white : colors.muted}
              />
              <Text style={[styles.toggleText, type === t && styles.toggleTextActive]}>
                {t === 'INDIVIDUAL' ? 'Individual' : 'Business Partner'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {type === 'INDIVIDUAL' ? (
            <>
              <Field label="Full Name" icon="person-outline" value={name} onChangeText={setName} placeholder="John Mensah" autoCapitalize="words" />
              <Field label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboard="email-address" />
              <Field label="Phone" icon="call-outline" value={phone} onChangeText={setPhone} placeholder="+233 24 000 0000" keyboard="phone-pad" />
              <Field label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Min. 8 characters" secure />
              <Field label="Confirm Password" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} placeholder="Repeat password" secure returnKeyType="done" onSubmitEditing={handleRegister} />
            </>
          ) : (
            <>
              <Field label="Business Name" icon="storefront-outline" value={bizName} onChangeText={setBizName} placeholder="e.g. Kofi's Kitchen" autoCapitalize="words" />
              <BusinessTypeSelector value={bizType} onChange={setBizType} />
              <Field label="Owner Full Name" icon="person-outline" value={ownerName} onChangeText={setOwnerName} placeholder="John Mensah" autoCapitalize="words" />
              <Field label="Business Email" icon="mail-outline" value={bizEmail} onChangeText={setBizEmail} placeholder="business@example.com" keyboard="email-address" />
              <Field label="Phone" icon="call-outline" value={bizPhone} onChangeText={setBizPhone} placeholder="+233 24 000 0000" keyboard="phone-pad" />
              <Field label="Business Address" icon="location-outline" value={bizAddress} onChangeText={setBizAddress} placeholder="Street address" autoCapitalize="sentences" />
              <Field label="GPS Address (optional)" icon="navigate-outline" value={gpsAddress} onChangeText={setGpsAddress} placeholder="GA-123-4567" />
              <Field label="Password" icon="lock-closed-outline" value={bizPassword} onChangeText={setBizPassword} placeholder="Min. 8 characters" secure />
              <Field label="Confirm Password" icon="lock-closed-outline" value={bizConfirm} onChangeText={setBizConfirm} placeholder="Repeat password" secure returnKeyType="done" onSubmitEditing={handleRegister} />
            </>
          )}

          <TouchableOpacity onPress={handleRegister} disabled={loading} style={[styles.btnWrap, loading && { opacity: 0.7 }]}>
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.btnText}>{type === 'INDIVIDUAL' ? 'Create Account' : 'Register Business'}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginText}>
            Already have an account?{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flexGrow: 1, paddingHorizontal: 24 },
  backBtn:  { marginBottom: 16 },
  title:    { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 20 },

  toggle: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: 4, marginBottom: 20,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: radius.md,
  },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText:       { fontSize: 13, fontWeight: '700', color: colors.muted },
  toggleTextActive: { color: colors.white },

  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: 24, ...shadow.md,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '15', borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.danger + '40',
    padding: 10, marginBottom: 16,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13 },
  fieldWrap: { marginBottom: 14 },
  label:     { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input:     { height: 48, color: colors.text, fontSize: 15 },
  eyeBtn:    { padding: 4 },

  dropdown: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight, marginTop: 4, overflow: 'hidden',
  },
  dropdownItem:       { paddingVertical: 12, paddingHorizontal: 16 },
  dropdownItemActive: { backgroundColor: colors.primary + '15' },
  dropdownText:       { fontSize: 14, color: colors.text, fontWeight: '600' },

  btnWrap: { marginTop: 8, borderRadius: radius.md, overflow: 'hidden', ...shadow.brand },
  btn:     { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  loginLink: { alignItems: 'center', marginTop: 24 },
  loginText: { color: colors.muted, fontSize: 14 },
});

import React, { useRef } from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator, Animated, StyleSheet, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radius, shadow } from '../constants/theme';

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary' | 'outline' | 'ghost' | 'danger'
  size = 'md',         // 'sm' | 'md' | 'lg'
  icon,
  fullWidth = false,
  style,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 8 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, friction: 8 }).start();

  const isDisabled = disabled || loading;

  const sizeStyle = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;

  const inner = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[
            styles.label,
            sizeStyle === styles.sm && styles.labelSm,
            sizeStyle === styles.lg && styles.labelLg,
            variant === 'outline' && { color: colors.primary },
            variant === 'ghost'   && { color: colors.textSecondary },
            variant === 'danger'  && { color: colors.danger },
          ]}>
            {title}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Animated.View style={[
      fullWidth && { width: '100%' },
      { transform: [{ scale }] },
      style,
    ]}>
      {variant === 'primary' ? (
        <TouchableOpacity
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          activeOpacity={1}
          disabled={isDisabled}
          style={{ borderRadius: radius.md, overflow: 'hidden', opacity: isDisabled ? 0.6 : 1, ...(fullWidth && { width: '100%' }) }}
        >
          <LinearGradient
            colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, sizeStyle, shadow.brand]}
          >
            {inner}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          activeOpacity={1}
          disabled={isDisabled}
          style={[
            styles.base,
            sizeStyle,
            variant === 'outline' && styles.outline,
            variant === 'ghost'   && styles.ghost,
            variant === 'danger'  && styles.danger,
            isDisabled && { opacity: 0.6 },
            fullWidth  && { width: '100%' },
          ]}
        >
          {inner}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm:  { paddingVertical: 10, paddingHorizontal: 18 },
  md:  { paddingVertical: 14, paddingHorizontal: 24 },
  lg:  { paddingVertical: 18, paddingHorizontal: 32 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  labelSm: { fontSize: 13 },
  labelLg: { fontSize: 17 },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger + '15',
    borderWidth: 1,
    borderColor: colors.danger + '40',
  },
});

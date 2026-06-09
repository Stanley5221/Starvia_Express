import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Animated, FlatList, StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as storage from '../lib/storage';
import { colors, radius } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon:     'rocket',
    iconColor: colors.primary,
    gradient: [colors.primary + '25', 'transparent'],
    title:    'Fast & Reliable',
    subtitle: 'Send anything, anywhere in the city. Our riders pick up in minutes and deliver on time, every time.',
  },
  {
    id: '2',
    icon:     'location',
    iconColor: colors.accent,
    gradient: [colors.accent + '20', 'transparent'],
    title:    'Track in Real-Time',
    subtitle: 'Watch your delivery move on the map live. Know exactly where your package is at every second.',
  },
  {
    id: '3',
    icon:     'shield-checkmark',
    iconColor: colors.success,
    gradient: [colors.success + '20', 'transparent'],
    title:    'Safe & Insured',
    subtitle: 'Every delivery is verified and insured. Rate your experience and help us serve you better.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const flatRef  = useRef(null);
  const scrollX  = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  async function finish() {
    await storage.setItemAsync('onboarded', '1');
    navigation.replace('Login');
  }

  function next() {
    if (index < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Skip */}
      {index < SLIDES.length - 1 && (
        <TouchableOpacity onPress={finish} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={i => i.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={e => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <LinearGradient
              colors={item.gradient}
              style={styles.iconBg}
            >
              <Ionicons name={item.icon} size={80} color={item.iconColor} />
            </LinearGradient>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Bottom section */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 32) }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity }]}
              />
            );
          })}
        </View>

        {/* Button */}
        <TouchableOpacity onPress={next} style={styles.btn} activeOpacity={0.85}>
          <LinearGradient
            colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btnGradient}
          >
            <Text style={styles.btnText}>
              {index === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={index === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={18}
              color={colors.white}
            />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 16 }}>
          <Text style={styles.loginLink}>
            Already have an account? <Text style={{ color: colors.accent }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  skip: { position: 'absolute', top: 56, right: 24, zIndex: 10 },
  skipText: { color: colors.muted, fontSize: 14, fontWeight: '600' },

  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  iconBg: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  bottom: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 0,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  btn: { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  btnGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  loginLink: { color: colors.muted, fontSize: 14 },
});

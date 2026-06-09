import React from 'react';
import { Platform, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

if (Platform.OS !== 'web') {
  const Mapbox = require('@rnmapbox/maps').default;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
}

function ThemedNavigation() {
  const { colors, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      theme={{
        ...base,
        colors: {
          ...base.colors,
          primary:      colors.primary,
          background:   colors.bg,
          card:         colors.surface,
          text:         colors.text,
          border:       colors.border,
          notification: colors.accent,
        },
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedNavigation />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}

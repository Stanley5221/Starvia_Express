import React from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Mapbox from '@rnmapbox/maps';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

if (Platform.OS !== 'web') {
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
}

function AppProviders({ children }) {
  if (Platform.OS === 'web') return children;
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
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
          card:         colors.card,
          text:         colors.text,
          border:       colors.border,
          notification: colors.amber,
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
    <AppProviders>
      <ThemeProvider>
        <AuthProvider>
          <ThemedNavigation />
        </AuthProvider>
      </ThemeProvider>
    </AppProviders>
  );
}

import React from 'react';
import { Platform } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Mapbox from '@rnmapbox/maps';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/constants/theme';

if (Platform.OS !== 'web') {
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
}

function AppProviders({ children }) {
  if (Platform.OS === 'web') return children;
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

export default function App() {
  return (
    <AppProviders>
    <AuthProvider>
      <NavigationContainer
        theme={{
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            primary: colors.primary,
            background: colors.bg,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.amber,
          },
        }}
      >
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
    </AppProviders>
  );
}

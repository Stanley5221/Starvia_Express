// Run `npx expo start -c` after changing any EXPO_PUBLIC_* vars in .env
// MAPBOX_DOWNLOADS_TOKEN must be a SECRET token (sk.ey...) from your Mapbox account:
//   Mapbox Dashboard → Account → Access Tokens → Create token → enable DOWNLOADS:READ
// For EAS Build, add it as an EAS secret instead of putting it in .env.
export default {
  expo: {
    name: 'Starvia Express Rider',
    slug: 'rider',
    owner: 'stanley5221',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#241212',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.starviaexpress.rider',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#8A053B',
      },
      edgeToEdgeEnabled: true,
      package: 'com.starviaexpress.rider',
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-secure-store',
      [
        'expo-image-picker',
        { photosPermission: 'Allow Starvia Express to access photos for proof of delivery.' },
      ],
      [
        'expo-location',
        { locationWhenInUsePermission: 'Starvia Express needs your location during active deliveries.' },
      ],
      [
        '@rnmapbox/maps',
        {
          // Needs sk.ey... secret download token for native builds.
          // Falls back to public token for dev — build may fail without the secret token.
          RNMapboxMapsDownloadToken:
            process.env.MAPBOX_DOWNLOADS_TOKEN ||
            process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
            '',
        },
      ],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
      eas: {
        projectId: '863b3f95-e4b7-4de2-a739-c5569306b1d5',
      },
    },
  },
};

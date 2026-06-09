export default {
  expo: {
    name: 'Starvia Express',
    slug: 'starvia-customer',
    owner: 'stanley5221',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0c0406',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.starvia.customer',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Starvia uses your location to set your pickup address.',
        NSLocationAlwaysUsageDescription: 'Starvia uses your location to track your delivery.',
        NSPhotoLibraryUsageDescription: 'Starvia needs access to your photos to attach a package photo.',
        NSCameraUsageDescription: 'Starvia needs camera access to take a package photo.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0c0406',
      },
      package: 'com.starvia.customer',
      edgeToEdgeEnabled: true,
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.RECORD_AUDIO',
      ],
    },
    plugins: [
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsDownloadToken:
            process.env.MAPBOX_DOWNLOADS_TOKEN ||
            process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
            '',
        },
      ],
      'expo-location',
      'expo-notifications',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Starvia to attach photos to your delivery.',
          cameraPermission: 'Allow Starvia to take a package photo.',
        },
      ],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
      eas: {
        projectId: '0c52d5ae-df87-40ff-87c3-1d8dd457ed7b',
      },
    },
  },
};

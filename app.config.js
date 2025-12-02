// app.config.js - Dynamic configuration that reads from environment variables
// This allows us to use the Google Maps API key from environment variables

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

module.exports = {
  expo: {
    name: 'Swipely',
    slug: 'swipely-app',
    version: '1.0.7',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'swipely',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.dayplay.app',
      buildNumber: '1',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription: 'This app uses your location to show nearby places and events.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'This app uses your location to show nearby places and events.',
        NSCameraUsageDescription: 'We use the camera so you can take photos for local suggestions.',
        NSPhotoLibraryUsageDescription: 'We need access to your photo library to upload photos for local suggestions.',
        NSPhotoLibraryAddUsageDescription: 'We need permission to save photos to your library.',
      },
      config: {
        googleMapsApiKey: googleMapsApiKey,
      },
    },
    android: {
      package: 'com.dayplay.app',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_EXTERNAL_STORAGE',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '',
        },
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-image-picker',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '429c510f-cead-4568-895d-285a6b7bbcb7',
      },
    },
  },
};


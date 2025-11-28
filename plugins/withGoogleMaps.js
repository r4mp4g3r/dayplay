// Custom config plugin for react-native-maps
// This ensures the Google Maps API key is properly configured
// The Android config.googleMaps.apiKey in app.config.js should handle most of it

module.exports = function withGoogleMaps(config, { apiKey } = {}) {
  // The android.config.googleMaps.apiKey in app.config.js should be sufficient
  // Expo will automatically inject it into AndroidManifest.xml during the build
  if (!apiKey) {
    console.warn('⚠️  Google Maps API key not provided. Maps may not work on Android.');
  }
  
  // Return config as-is since android.config.googleMaps.apiKey is handled by Expo
  return config;
};


// Platform-aware wrapper to avoid importing native-only modules on web
// This prevents web bundlers from pulling in react-native-maps
import { Platform } from 'react-native';

let ExploreMap: any;

if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExploreMap = require('./ExploreMap.web').ExploreMap;
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExploreMap = require('./ExploreMap.native').ExploreMap;
}

export { ExploreMap };


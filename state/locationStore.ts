import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVAILABLE_CITIES } from '@/data/multi-city-seed';

type LocationState = {
  latitude: number | null;
  longitude: number | null;
  city: string;
  granted: boolean;
  loading: boolean;
  manuallySelected: boolean;
};

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Austin': { lat: 30.2672, lng: -97.7431 },
  'Denver': { lat: 39.7392, lng: -104.9903 },
  'Nashville': { lat: 36.1627, lng: -86.7816 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'San Francisco Bay Area': { lat: 37.7749, lng: -122.4194 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Linköping': { lat: 58.4108, lng: 15.6214 },
};

const DEFAULT_STATE: LocationState = {
  latitude: 30.2672, // Austin fallback
  longitude: -97.7431,
  city: 'Austin',
  granted: false,
  loading: false,
  manuallySelected: false,
};

const STORAGE_KEY = 'selected-city';

let listeners: Array<() => void> = [];
let state: LocationState = { ...DEFAULT_STATE };

function updateState(updates: Partial<LocationState>) {
  state = { ...state, ...updates };
  listeners.forEach((l) => l());
}

export async function requestLocation() {
  if (state.granted) return;
  
  updateState({ loading: true });
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      updateState({ loading: false, granted: false });
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const [geocode] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    updateState({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      city: geocode?.city || 'Unknown',
      granted: true,
      loading: false,
    });
  } catch (error) {
    console.error('Location error:', error);
    updateState({ loading: false, granted: false });
  }
}

// Load saved city preference
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(STORAGE_KEY).then((savedCity) => {
    if (savedCity && CITY_COORDS[savedCity]) {
      const coords = CITY_COORDS[savedCity];
      state = {
        ...state,
        city: savedCity,
        latitude: coords.lat,
        longitude: coords.lng,
        manuallySelected: true,
      };
      listeners.forEach((l) => l());
    }
  });
}

export async function selectCity(cityName: string) {
  if (!CITY_COORDS[cityName]) {
    console.error('Unknown city:', cityName);
    return;
  }

  const coords = CITY_COORDS[cityName];
  updateState({
    city: cityName,
    latitude: coords.lat,
    longitude: coords.lng,
    manuallySelected: true,
  });

  // Save preference
  if (typeof window !== 'undefined') {
    await AsyncStorage.setItem(STORAGE_KEY, cityName);
  }

  // Reset "New This Week" filter when changing cities (to avoid empty results)
  // Import filterStore dynamically to avoid circular dependency
  try {
    const { useFilterStore } = await import('./filterStore');
    // This is a hack - would be better to use a proper store method
    if (typeof window !== 'undefined') {
      AsyncStorage.getItem('filter-store').then((data) => {
        if (data) {
          const filters = JSON.parse(data);
          filters.showNewThisWeek = false;
          AsyncStorage.setItem('filter-store', JSON.stringify(filters));
        }
      });
    }
  } catch (e) {
    console.log('Could not reset filters');
  }
}

export function useLocationStore() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    ...state,
    requestLocation,
    selectCity,
    availableCities: AVAILABLE_CITIES,
  };
}


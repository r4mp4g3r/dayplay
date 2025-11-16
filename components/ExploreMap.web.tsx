import React from 'react';
import { View, Text } from 'react-native';

type Props = {
  items: any[];
  latitude: number;
  longitude: number;
};

export function ExploreMap({ items, latitude, longitude }: Props) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🗺️</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Map view unavailable on web</Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 }}>
        Use the iOS or Android app for full map experience
      </Text>
    </View>
  );
}


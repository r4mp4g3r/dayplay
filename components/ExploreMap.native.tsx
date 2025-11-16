import React from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

type Props = {
  items: any[];
  latitude: number;
  longitude: number;
};

export function ExploreMap({ items, latitude, longitude }: Props) {
  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={{ 
        latitude, 
        longitude, 
        latitudeDelta: 0.2, 
        longitudeDelta: 0.2 
      }}
    >
      {items.map((it) => (
        <Marker 
          key={it.id} 
          coordinate={{ latitude: it.latitude, longitude: it.longitude }} 
          title={it.title}
          description={it.subtitle}
          onCalloutPress={() => router.push(`/listing/${it.id}`)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});


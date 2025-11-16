import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export function ListingMap({ latitude, longitude }: { latitude: number; longitude: number }) {
	return (
		<View style={styles.container}>
			<MapView
				style={StyleSheet.absoluteFill}
				initialRegion={{ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
				pointerEvents="none"
			>
				<Marker coordinate={{ latitude, longitude }} />
			</MapView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
});



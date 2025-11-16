import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

export function ListingMap({ latitude, longitude }: { latitude: number; longitude: number }) {
	return (
		<View style={[styles.container, styles.webPlaceholder]}>
			<Text style={{ color: '#666', fontWeight: '600' }}>Map preview unavailable on web</Text>
			<Text style={{ color: '#888', marginTop: 4 }}>
				{latitude.toFixed(4)}, {longitude.toFixed(4)}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
	webPlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#f6f6f6',
		borderWidth: 1,
		borderColor: '#eee',
	},
});



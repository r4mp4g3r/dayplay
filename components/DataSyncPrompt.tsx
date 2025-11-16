import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';

type Props = {
  visible: boolean;
  itemCount: number;
  onSync: () => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
};

export function DataSyncPrompt({ visible, itemCount, onSync, onSkip, onClose }: Props) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.content}>
          <Text style={styles.icon}>☁️</Text>
          <Text style={styles.title}>Sync to Cloud?</Text>
          <Text style={styles.message}>
            You have {itemCount} saved item{itemCount !== 1 ? 's' : ''} on this device.
            {'\n\n'}
            Sync them to your account to access across all your devices?
          </Text>

          <Pressable
            style={[styles.button, styles.primaryButton, syncing && { opacity: 0.6 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                Sync {itemCount} Item{itemCount !== 1 ? 's' : ''}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={onSkip}
            disabled={syncing}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Skip for Now
            </Text>
          </Pressable>

          <Pressable onPress={onClose} disabled={syncing} style={{ marginTop: 8 }}>
            <Text style={{ textAlign: 'center', color: '#999', fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  content: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 24, 
    width: '100%', 
    maxWidth: 340,
    alignItems: 'center',
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  message: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  button: { 
    width: '100%',
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: { backgroundColor: '#111' },
  secondaryButton: { backgroundColor: '#f0f0f0' },
  buttonText: { fontWeight: '800', fontSize: 16 },
  primaryButtonText: { color: '#fff' },
  secondaryButtonText: { color: '#111' },
});


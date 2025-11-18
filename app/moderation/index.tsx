import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  getPendingFavorites,
  approveLocalFavorite,
  rejectLocalFavorite,
} from '@/lib/localsFavoritesApi';
import type { LocalFavorite } from '@/types/domain';

export default function ModerationScreen() {
  const [pending, setPending] = useState<LocalFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      const data = await getPendingFavorites();
      setPending(data);
    } catch (error) {
      console.error('Error loading pending favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPending();
  };

  const handleApprove = async (id: string) => {
    Alert.alert('Approve Submission?', 'This will make the favorite visible to all users.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        style: 'default',
        onPress: async () => {
          const success = await approveLocalFavorite(id);
          if (success) {
            setPending((prev) => prev.filter((item) => item.id !== id));
            Alert.alert('✅ Approved!', 'The favorite is now live.');
          } else {
            Alert.alert('Error', 'Failed to approve. Please try again.');
          }
        },
      },
    ]);
  };

  const handleRejectPrompt = (id: string) => {
    setRejectingId(id);
  };

  const handleRejectConfirm = async () => {
    if (!rejectingId) return;

    if (!rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for rejection.');
      return;
    }

    const success = await rejectLocalFavorite(rejectingId, rejectReason.trim());
    
    if (success) {
      setPending((prev) => prev.filter((item) => item.id !== rejectingId));
      setRejectingId(null);
      setRejectReason('');
      Alert.alert('❌ Rejected', 'The user will be notified.');
    } else {
      Alert.alert('Error', 'Failed to reject. Please try again.');
    }
  };

  const renderItem = ({ item }: { item: LocalFavorite }) => (
    <View style={styles.card}>
      {/* Image */}
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderIcon}>📍</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.description} numberOfLines={3}>
          {item.description}
        </Text>

        <View style={styles.meta}>
          <Text style={styles.metaText}>By: {item.user_display_name || 'Anonymous'}</Text>
          <Text style={styles.metaText}>
            {item.address || `${item.latitude}, ${item.longitude}`}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleApprove(item.id)}
          >
            <Text style={styles.approveBtnText}>✓ Approve</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleRejectPrompt(item.id)}
          >
            <Text style={styles.rejectBtnText}>✕ Reject</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Moderation Queue</Text>
        <Text style={styles.headerSubtitle}>
          {pending.length} pending submission{pending.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      {pending.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>✅</Text>
          <Text style={styles.emptyStateTitle}>All Clear!</Text>
          <Text style={styles.emptyStateText}>
            No pending submissions to review at the moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reason for Rejection</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Inappropriate content, duplicate, spam..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={handleRejectConfirm}
              >
                <Text style={styles.modalConfirmText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#666' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 200, backgroundColor: '#f0f0f0' },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9e9e9',
  },
  imagePlaceholderIcon: { fontSize: 48 },
  cardContent: { padding: 16 },
  name: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  category: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  description: { fontSize: 15, color: '#666', lineHeight: 21, marginBottom: 12 },
  meta: { marginBottom: 16 },
  metaText: { fontSize: 13, color: '#999', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveBtn: { backgroundColor: '#4CAF50' },
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rejectBtn: { backgroundColor: '#FF5252' },
  rejectBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateIcon: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtn: { backgroundColor: '#f0f0f0' },
  modalCancelText: { color: '#333', fontSize: 16, fontWeight: '700' },
  modalConfirmBtn: { backgroundColor: '#FF5252' },
  modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});


import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * VisitDetailScreen
 *
 * Displays details for a specific EVV visit. Receives visitId via route
 * params (navigated from DashboardScreen or ClockInScreen post-clock-out).
 *
 * TODO: Wire GET /api/evv/visits/:visitId to populate fields below.
 * TODO: Add "Request Correction" button → navigates to /correction with visitId.
 */
export default function VisitDetailScreen() {
  const router = useRouter();
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Visit Detail</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Visit ID</Text>
          <Text style={styles.value}>{visitId ?? '—'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>—</Text>
          <Text style={styles.hint}>Populated once GET /api/evv/visits/:id is wired</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Clock-in</Text>
          <Text style={styles.value}>—</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Clock-out</Text>
          <Text style={styles.value}>—</Text>
        </View>

        <Pressable
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/correction', params: { visitId: visitId ?? '' } })}
        >
          <Text style={styles.actionButtonText}>Request Correction</Text>
        </Pressable>

        <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={() => router.back()}>
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c', marginBottom: 16 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  label: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16, color: '#1a3a5c', marginTop: 4 },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' },
  actionButton: {
    backgroundColor: '#1a5fa8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1a5fa8' },
  secondaryButtonText: { color: '#1a5fa8' },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

/**
 * CorrectionScreen (Visit Maintenance Unlock Request — VMUR)
 *
 * Allows a caregiver to file a correction request for a completed visit.
 * Posts to POST /api/maintenance/caregiver-correction.
 *
 * The backend already implements this endpoint (packages/app maintenance-routes.ts)
 * with PA DHS-required fields: reasonCategoryCode, correctionCode, reason text.
 *
 * TODO: Add dropdown pickers for reasonCategoryCode and correctionCode enums
 *       (currently free-text — acceptable for placeholder release).
 */
export default function CorrectionScreen() {
  const router = useRouter();
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();

  const [reasonCategory, setReasonCategory] = useState('');
  const [correctionCode, setCorrectionCode] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!visitId) {
      Alert.alert('Error', 'No visit ID provided.');
      return;
    }
    if (!reasonCategory.trim() || !correctionCode.trim() || !reason.trim()) {
      Alert.alert('Validation', 'All fields are required.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/api/maintenance/caregiver-correction', {
        visitId,
        reasonCategoryCode: reasonCategory.trim(),
        correctionCode: correctionCode.trim(),
        reason: reason.trim(),
      });
      Alert.alert('Submitted', 'Your correction request has been sent to your coordinator for review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Correction submit failed', error);
      Alert.alert('Error', 'Failed to submit correction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Request Correction</Text>
        <Text style={styles.subtitle}>Visit ID: {visitId ?? '—'}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Reason Category Code</Text>
          <TextInput
            style={styles.input}
            value={reasonCategory}
            onChangeText={setReasonCategory}
            placeholder="e.g. LATEMISSED"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Correction Code</Text>
          <TextInput
            style={styles.input}
            value={correctionCode}
            onChangeText={setCorrectionCode}
            placeholder="e.g. TIMEERROR"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Reason / Explanation</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={reason}
            onChangeText={setReason}
            placeholder="Describe what needs to be corrected and why…"
            multiline
            numberOfLines={4}
          />
        </View>

        {submitting ? (
          <ActivityIndicator size="large" color="#1a5fa8" style={{ marginTop: 16 }} />
        ) : (
          <>
            <Pressable style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Submit Correction Request</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c', marginBottom: 4 },
  subtitle: { color: '#64748b', fontSize: 14, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    fontSize: 15,
    color: '#1a3a5c',
  },
  multiline: { height: 100, textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: '#1a5fa8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  cancelButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: { color: '#64748b', fontWeight: '600', fontSize: 16 },
});

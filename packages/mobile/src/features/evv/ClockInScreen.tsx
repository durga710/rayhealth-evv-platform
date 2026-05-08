import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import apiClient from '../../lib/api-client';

export default function ClockInScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [visit, setVisit] = useState<{ id: string } | null>(null);

  const handleClockIn = async () => {
    setIsLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is required for EVV.');
      setIsLoading(false);
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const payload = {
        assignmentId: 'mock-assignment-id', // Placeholder
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        }
      };

      const { data } = await apiClient.post('/api/evv/clock-in', payload);
      setVisit(data);
      Alert.alert('Success', 'Clocked in successfully!');
    } catch (error) {
      console.error('Clock-in failed', error);
      Alert.alert('Error', 'Failed to clock in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClockOut = async () => {
    if (!visit) return;
    setIsLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is required for EVV.');
      setIsLoading(false);
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const payload = {
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        }
      };

      await apiClient.post(`/api/evv/clock-out/${visit.id}`, payload);
      setVisit(null);
      Alert.alert('Success', 'Clocked out successfully!');
    } catch (error) {
      console.error('Clock-out failed', error);
      Alert.alert('Error', 'Failed to clock out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EVV Visit</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#1a5fa8" />
      ) : (
        <View style={styles.buttonContainer}>
          {!visit ? (
            <Button title="Clock In" onPress={handleClockIn} />
          ) : (
            <Button title="Clock Out" onPress={handleClockOut} color="#f97316"/>
          )}
        </View>
      )}
      {visit && (
        <Text style={styles.statusText}>
          Current Status: Clocked In
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4f8', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a3a5c', marginBottom: 24 },
  buttonContainer: { width: '80%' },
  statusText: { marginTop: 20, fontSize: 16, color: '#5b8fc9' },
});


import React from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';

const mockAssignments = [
  { id: '1', client: 'John D.', time: '9:00 AM - 11:00 AM' },
  { id: '2', client: 'Jane S.', time: '1:00 PM - 3:00 PM' },
];

export default function DashboardScreen() {
  const { logout } = useAuth();
  const router = useRouter();

  const renderItem = ({ item }: { item: typeof mockAssignments[0] }) => (
    <View style={styles.item}>
      <Text style={styles.itemText}>{item.client}</Text>
      <Text>{item.time}</Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Visits</Text>
        <Text style={{color: '#1a5fa8'}} onPress={() => { logout(); router.replace('/login'); }}>Logout</Text>
      </View>
      <FlatList
        data={mockAssignments}
        renderItem={renderItem}
        keyExtractor={item => item.id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c' },
  item: { backgroundColor: 'white', padding: 20, marginVertical: 8, marginHorizontal: 16, borderRadius: 8, elevation: 1 },
  itemText: { fontSize: 18, fontWeight: '500' },
});

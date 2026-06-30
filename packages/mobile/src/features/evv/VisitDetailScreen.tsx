import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import ScreenHeader from '../common/ScreenHeader';

const SERVICE_LABELS: Record<string, string> = {
  T1019: 'Personal Care',
  S5125: 'Attendant Care',
  T1004: 'Home Health Aide',
  T1021: 'Home Health Aide Visit',
};

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';
}

function fmtDuration(inIso?: string, outIso?: string): string {
  if (!inIso || !outIso) return '—';
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function VisitDetailScreen() {
  const params = useLocalSearchParams();

  const clientName = one(params.clientName) ?? 'Client';
  const clockInTime = one(params.clockInTime);
  const clockOutTime = one(params.clockOutTime);
  const status = (one(params.status) ?? 'pending') as 'verified' | 'flagged' | 'pending';
  const serviceCode = one(params.serviceCode);
  const flagReason = one(params.flagReason);

  const inProgress = !clockOutTime;
  const meta =
    status === 'verified'
      ? { color: '#16a34a', label: 'Verified', icon: 'shield-checkmark' as const, sub: 'GPS confirmed at clock-in and clock-out.' }
      : status === 'flagged'
      ? { color: '#d97706', label: 'Flagged', icon: 'alert-circle' as const, sub: 'This visit needs a coordinator review.' }
      : inProgress
      ? { color: '#1a5fa8', label: 'In progress', icon: 'time' as const, sub: 'This visit is currently underway.' }
      : { color: '#64748b', label: 'Pending', icon: 'ellipse' as const, sub: 'Awaiting verification.' };

  const service = serviceCode ? SERVICE_LABELS[serviceCode] ?? serviceCode : 'Visit';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Visit details" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status hero */}
        <View style={styles.heroCard}>
          <View style={[styles.heroIcon, { backgroundColor: `${meta.color}1a` }]}>
            <Ionicons name={meta.icon} size={28} color={meta.color} />
          </View>
          <Text style={styles.heroClient}>{clientName}</Text>
          <View style={[styles.heroPill, { backgroundColor: `${meta.color}1a` }]}>
            <Text style={[styles.heroPillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.heroSub}>{meta.sub}</Text>
        </View>

        {/* Flag explanation */}
        {status === 'flagged' ? (
          <View style={styles.flagCard}>
            <View style={styles.flagHead}>
              <Ionicons name="alert-circle" size={18} color="#b45309" />
              <Text style={styles.flagTitle}>Why was this flagged?</Text>
            </View>
            <Text style={styles.flagBody}>
              {flagReason ??
                'A specific reason will appear here once this visit finishes syncing with the office. Common reasons include a late clock-in, clocking out away from the client, or low GPS accuracy.'}
            </Text>
            <Text style={styles.flagNote}>Your coordinator may follow up. No action is needed from you right now.</Text>
          </View>
        ) : null}

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visit summary</Text>
          <Row label="Date" value={fmtDate(clockInTime)} />
          <Row label="Clock in" value={fmtTime(clockInTime)} />
          <Row label="Clock out" value={inProgress ? 'In progress' : fmtTime(clockOutTime)} />
          <Row label="Duration" value={fmtDuration(clockInTime, clockOutTime)} />
          <Row label="Service" value={service} />
        </View>

        <View style={styles.evvNote}>
          <Ionicons name="lock-closed" size={13} color="#7a98b4" style={{ marginTop: 1 }} />
          <Text style={styles.evvNoteText}>
            Clock-in and clock-out GPS are recorded for PA EVV compliance and cannot be edited from the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  heroCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 22, alignItems: 'center',
    shadowColor: '#0f2d52', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  heroIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroClient: { fontSize: 20, fontWeight: '900', color: '#0f2d52', textAlign: 'center' },
  heroPill: { marginTop: 10, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  heroPillText: { fontSize: 13, fontWeight: '800' },
  heroSub: { fontSize: 13, color: '#5a7088', textAlign: 'center', marginTop: 10, lineHeight: 18 },

  flagCard: {
    backgroundColor: '#fffbeb', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#fde68a',
  },
  flagHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flagTitle: { fontSize: 15, fontWeight: '900', color: '#b45309' },
  flagBody: { fontSize: 14, color: '#92400e', lineHeight: 20, fontWeight: '600' },
  flagNote: { fontSize: 12, color: '#b45309', lineHeight: 17, marginTop: 10 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    shadowColor: '#0f2d52', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#0f2d52', marginBottom: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e6edf4',
  },
  rowLabel: { fontSize: 13, color: '#5a7088', fontWeight: '600' },
  rowValue: { fontSize: 14, color: '#1a3a5c', fontWeight: '800' },

  evvNote: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  evvNoteText: { flex: 1, color: '#7a98b4', fontSize: 12, lineHeight: 18 },
});

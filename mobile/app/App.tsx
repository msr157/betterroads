import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { JourneyRecorder } from '@/journeyRecorder';
import type { EngineSnapshot } from '@/sensorEngine';
import { flushQueue, pendingCount, uploadOrQueue } from '@/upload';
import { VEHICLES } from '@/vehicles';
import type { VehicleType } from '@/types';
import { theme } from '@/theme';

type Phase = 'idle' | 'recording' | 'uploading';

/**
 * v1 single screen: pick a vehicle, ride, stop — the journey uploads itself
 * (or queues offline). Deliberately minimal; the map/history/leaderboard
 * screens from the Kotlin prototype come after the data pipeline is proven.
 */
export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [vehicle, setVehicle] = useState<VehicleType>('CAR');
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  const recorderRef = useRef<JourneyRecorder | null>(null);

  // On launch: retry any journeys stranded by earlier offline stops.
  useEffect(() => {
    void (async () => {
      await flushQueue();
      setPending(await pendingCount());
    })();
  }, []);

  // Live telemetry while recording.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const s = recorderRef.current?.snapshot();
      if (s) setSnap({ ...s });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const startJourney = useCallback(async () => {
    setMessage(null);
    if (!(await JourneyRecorder.requestPermissions())) {
      setMessage('Location permission is required to record a journey.');
      return;
    }
    const recorder = new JourneyRecorder(vehicle);
    recorderRef.current = recorder;
    await recorder.start();
    setSnap(null);
    setPhase('recording');
  }, [vehicle]);

  const stopJourney = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setPhase('uploading');
    const payload = await recorder.stop();
    recorderRef.current = null;

    if (!payload) {
      setMessage('No GPS fix during this trip — nothing to upload.');
      setPhase('idle');
      return;
    }
    const result = await uploadOrQueue(payload);
    setPending(await pendingCount());
    setMessage(
      result === 'uploaded'
        ? `Journey uploaded — ${payload.segments.length} road segments, ${payload.events.length} events.`
        : 'Offline — journey saved and will upload automatically later.',
    );
    setPhase('idle');
  }, []);

  const recording = phase === 'recording';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.wordmark}>
          BetterRoads<Text style={styles.accent}>.</Text>
        </Text>
        <Text style={styles.tagline}>Every ride scores the road.</Text>

        {/* ── Vehicle picker ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Vehicle</Text>
        <View style={styles.chipRow}>
          {VEHICLES.map((v) => (
            <Pressable
              key={v.type}
              disabled={recording}
              onPress={() => setVehicle(v.type)}
              style={[styles.chip, vehicle === v.type && styles.chipActive]}
            >
              <Text style={[styles.chipText, vehicle === v.type && styles.chipTextActive]}>
                {v.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Live telemetry ─────────────────────────────────────────── */}
        {recording && (
          <View style={styles.card}>
            <View style={styles.statRow}>
              <Stat label="Distance" value={`${((snap?.distanceM ?? 0) / 1000).toFixed(2)} km`} />
              <Stat label="Live RQI" value={`${Math.round(snap?.liveSegmentRqi ?? 100)}`} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Events" value={`${snap?.eventCount ?? 0}`} />
              <Stat label="Segments" value={`${snap?.segmentCount ?? 0}`} />
            </View>
            {snap && !snap.isStableMount && (
              <Text style={styles.warning}>
                Phone looks unmounted — fix it to a dashboard or holder so readings count.
              </Text>
            )}
          </View>
        )}

        {/* ── Start / stop ───────────────────────────────────────────── */}
        <Pressable
          onPress={recording ? stopJourney : startJourney}
          disabled={phase === 'uploading'}
          style={[styles.mainButton, recording && styles.mainButtonStop]}
        >
          {phase === 'uploading' ? (
            <ActivityIndicator color={theme.ink} />
          ) : (
            <Text style={styles.mainButtonText}>
              {recording ? 'End journey' : 'Start journey'}
            </Text>
          )}
        </Pressable>

        {message && <Text style={styles.message}>{message}</Text>}
        {pending > 0 && (
          <Text style={styles.pending}>
            {pending} journey{pending === 1 ? '' : 's'} waiting to upload
          </Text>
        )}

        <Text style={styles.footnote}>
          Recording runs while the app is open. No account, no sign-in — your phone contributes
          anonymously via an install ID.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 24, paddingTop: 64, gap: 12 },
  wordmark: { color: theme.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  accent: { color: theme.saffron },
  tagline: { color: theme.ink2, fontSize: 15, marginBottom: 16 },
  sectionLabel: {
    color: theme.ink3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { borderColor: theme.saffronDeep, backgroundColor: theme.saffronTint },
  chipText: { color: theme.ink2, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: theme.saffronLift },
  card: {
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.bg2,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1 },
  statLabel: { color: theme.ink3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { color: theme.ink, fontSize: 26, fontWeight: '700', marginTop: 2 },
  warning: { color: theme.warn, fontSize: 13, lineHeight: 18 },
  mainButton: {
    backgroundColor: theme.saffronDeep,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 24,
  },
  mainButtonStop: { backgroundColor: theme.danger },
  mainButtonText: { color: theme.ink, fontSize: 17, fontWeight: '800' },
  message: { color: theme.ink, fontSize: 14, lineHeight: 20, marginTop: 8 },
  pending: { color: theme.ink2, fontSize: 13 },
  footnote: { color: theme.ink3, fontSize: 12, lineHeight: 18, marginTop: 24 },
});

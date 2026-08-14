import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { JourneyRecorder } from '@/journeyRecorder';
import type { EngineSnapshot } from '@/sensorEngine';
import { flushQueue, pendingCount, uploadOrQueue } from '@/upload';
import { VEHICLES } from '@/vehicles';
import type { VehicleType } from '@/types';
import { theme } from '@/theme';
import { deleteAccount, exchangeGoogleToken, logout, restoreUser, updateProfile, type UserProfile } from '@/auth';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

type Phase = 'idle' | 'recording' | 'uploading';

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [vehicle, setVehicle] = useState<VehicleType>('CAR');
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const recorderRef = useRef<JourneyRecorder | null>(null);

  useEffect(() => { void (async () => { const restored = await restoreUser(); setUser(restored); if (restored) await flushQueue(); setPending(await pendingCount()); setBooting(false); })(); }, []);
  useEffect(() => { if (phase !== 'recording') return; const id = setInterval(() => { const s = recorderRef.current?.snapshot(); if (s) setSnap({ ...s }); }, 1000); return () => clearInterval(id); }, [phase]);

  const handleGoogleLogin = useCallback(async () => {
    try {
      setAuthError(null);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'success') {
        const idToken = response.data.idToken;
        if (!idToken) throw new Error('Google did not return an ID token.');
        setBooting(true);
        const profile = await exchangeGoogleToken(idToken);
        setUser(profile);
        await flushQueue();
      }
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED') setAuthError(e.message || 'Sign-in failed.');
    } finally {
      setBooting(false);
    }
  }, []);

  const startJourney = useCallback(async () => {
    setMessage(null);
    if (!(await JourneyRecorder.requestPermissions())) { setMessage('Location permission is required to record a journey.'); return; }
    const recorder = new JourneyRecorder(vehicle); recorderRef.current = recorder; await recorder.start(); setSnap(null); setPhase('recording');
  }, [vehicle]);
  const stopJourney = useCallback(async () => {
    const recorder = recorderRef.current; if (!recorder) return;
    setPhase('uploading'); const payload = await recorder.stop(); recorderRef.current = null;
    if (!payload) { setMessage('No GPS fix during this trip — nothing to upload.'); setPhase('idle'); return; }
    const result = await uploadOrQueue(payload); setPending(await pendingCount());
    if (result === 'auth-expired') { setMessage('Your session expired. The journey is saved; sign in again to upload it.'); setUser(null); }
    else if (result === 'rejected') setMessage('The server rejected this journey. It remains saved on this device; contact support before removing it.');
    else setMessage(result === 'uploaded' ? `Journey uploaded — ${payload.segments.length} road segments, ${payload.events.length} events.` : 'Offline — journey saved and will upload automatically later.'); setPhase('idle');
  }, []);

  if (booting) return <SafeAreaView style={[styles.root, styles.center]}><ActivityIndicator color={theme.saffronDeep} /></SafeAreaView>;
  if (!user) return <SafeAreaView style={styles.root}><StatusBar style="light" /><View style={[styles.scroll, styles.center]}><Text style={styles.wordmark}>BetterRoads<Text style={styles.accent}>.</Text></Text><Text style={styles.tagline}>Sign in to record and attribute your road contributions.</Text><Pressable style={styles.mainButton} onPress={() => void handleGoogleLogin()}><Text style={styles.mainButtonText}>Continue with Google</Text></Pressable>{authError && <Text style={styles.warning}>{authError}</Text>}<Text style={styles.footnote}>Your Google email identifies your account and is never shown on the public leaderboard.</Text></View></SafeAreaView>;
  if (editingProfile) return <ProfileEditor user={user} onSaved={(next) => { setUser(next); setEditingProfile(false); }} onDeleted={() => setUser(null)} onCancel={() => setEditingProfile(false)} />;
  const recording = phase === 'recording';

  return <SafeAreaView style={styles.root}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.scroll}>
    <Text style={styles.wordmark}>BetterRoads<Text style={styles.accent}>.</Text></Text><Text style={styles.tagline}>Every ride scores the road.</Text>
    <View style={styles.accountRow}><View style={{ flex: 1 }}><Text style={styles.accountName}>{user.name}</Text><Text style={styles.accountEmail}>{user.email}</Text></View><Pressable onPress={() => setEditingProfile(true)}><Text style={styles.accountAction}>Profile</Text></Pressable><Pressable onPress={() => void logout().then(() => setUser(null))}><Text style={styles.accountAction}>Log out</Text></Pressable></View>
    <Text style={styles.sectionLabel}>Vehicle</Text><View style={styles.chipRow}>{VEHICLES.map((v) => <Pressable key={v.type} disabled={recording} onPress={() => setVehicle(v.type)} style={[styles.chip, vehicle === v.type && styles.chipActive]}><Text style={[styles.chipText, vehicle === v.type && styles.chipTextActive]}>{v.label}</Text></Pressable>)}</View>
    {recording && <View style={styles.card}><View style={styles.statRow}><Stat label="Distance" value={`${((snap?.distanceM ?? 0) / 1000).toFixed(2)} km`} /><Stat label="Live RQI" value={`${Math.round(snap?.liveSegmentRqi ?? 100)}`} /></View><View style={styles.statRow}><Stat label="Events" value={`${snap?.eventCount ?? 0}`} /><Stat label="Segments" value={`${snap?.segmentCount ?? 0}`} /></View>{snap && !snap.isStableMount && <Text style={styles.warning}>Phone looks unmounted — fix it to a dashboard or holder so readings count.</Text>}</View>}
    <Pressable onPress={recording ? stopJourney : startJourney} disabled={phase === 'uploading'} style={[styles.mainButton, recording && styles.mainButtonStop]}>{phase === 'uploading' ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.mainButtonText}>{recording ? 'End journey' : 'Start journey'}</Text>}</Pressable>
    {message && <Text style={styles.message}>{message}</Text>}{pending > 0 && <Text style={styles.pending}>{pending} journey{pending === 1 ? '' : 's'} waiting to upload</Text>}
    <Text style={styles.footnote}>Recording runs while the app is open. Journeys are attributed to your account; your profile remains private unless you opt in to the leaderboard.</Text>
  </ScrollView></SafeAreaView>;
}

function ProfileEditor({ user, onSaved, onDeleted, onCancel }: { user: UserProfile; onSaved: (user: UserProfile) => void; onDeleted: () => void; onCancel: () => void }) {
  const [name, setName] = useState(user.name), [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ?? ''), [gender, setGender] = useState(user.gender ?? ''), [genderSelfDescription, setGenderSelfDescription] = useState(user.genderSelfDescription ?? ''), [city, setCity] = useState(user.city ?? '');
  const [publicLeaderboard, setPublicLeaderboard] = useState(user.publicLeaderboard), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false);
  const save = async () => { if (!name.trim()) return setError('Name is required.'); if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return setError('Date of birth must be YYYY-MM-DD.'); setSaving(true); setError(null); try { onSaved(await updateProfile({ name: name.trim(), dateOfBirth: dateOfBirth || null, gender: gender || null, genderSelfDescription: genderSelfDescription || null, city: city.trim() || null, publicLeaderboard })); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save profile.'); setSaving(false); } };
  const confirmDelete = () => Alert.alert('Delete account?', 'Your profile and account links will be permanently removed. Anonymized road measurements remain in the public road dataset.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteAccount().then(onDeleted).catch((e) => setError(e instanceof Error ? e.message : 'Could not delete account.')) }]);
  return <SafeAreaView style={styles.root}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.scroll}><Text style={styles.wordmark}>Your profile</Text><Field label="Name *" value={name} onChangeText={setName} /><Field label="Google email (read only)" value={user.email} editable={false} /><Field label="Date of birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} /><Text style={styles.sectionLabel}>Gender (optional)</Text><View style={styles.chipRow}>{['', 'male', 'female', 'non-binary', 'self-described', 'prefer-not-to-say'].map((v) => <Pressable key={v || 'none'} onPress={() => setGender(v)} style={[styles.chip, gender === v && styles.chipActive]}><Text style={[styles.chipText, gender === v && styles.chipTextActive]}>{v || 'Not set'}</Text></Pressable>)}</View>{gender === 'self-described' && <Field label="Describe your gender" value={genderSelfDescription} onChangeText={setGenderSelfDescription} />}<Field label="City" value={city} onChangeText={setCity} /><Pressable style={styles.consentRow} onPress={() => setPublicLeaderboard((v) => !v)}><View style={[styles.checkbox, publicLeaderboard && styles.checkboxActive]} /><Text style={[styles.message, { flex: 1 }]}>Show my name and contribution totals publicly</Text></Pressable>{error && <Text style={styles.warning}>{error}</Text>}<Pressable style={styles.mainButton} disabled={saving} onPress={() => void save()}>{saving ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.mainButtonText}>Save profile</Text>}</Pressable><Pressable onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable onPress={confirmDelete}><Text style={[styles.cancel, { color: theme.danger }]}>Delete account</Text></Pressable></ScrollView></SafeAreaView>;
}

function Field(props: { label: string; value: string; onChangeText?: (text: string) => void; editable?: boolean }) { return <View><Text style={styles.sectionLabel}>{props.label}</Text><TextInput style={[styles.input, props.editable === false && styles.inputDisabled]} placeholderTextColor={theme.ink3} {...props} /></View>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg }, center: { justifyContent: 'center' }, scroll: { padding: 24, paddingTop: 64, gap: 12 }, wordmark: { color: theme.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1 }, accent: { color: theme.saffron }, tagline: { color: theme.ink2, fontSize: 15, marginBottom: 16 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: theme.line, paddingBottom: 14 }, accountName: { color: theme.ink, fontWeight: '700' }, accountEmail: { color: theme.ink3, fontSize: 11 }, accountAction: { color: theme.saffronLift, fontSize: 13, fontWeight: '700' },
  sectionLabel: { color: theme.ink3, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: theme.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }, chipActive: { borderColor: theme.saffronDeep, backgroundColor: theme.saffronTint }, chipText: { color: theme.ink2, fontSize: 13, fontWeight: '600' }, chipTextActive: { color: theme.saffronLift },
  card: { borderWidth: 1, borderColor: theme.line, backgroundColor: theme.bg2, borderRadius: 16, padding: 16, marginTop: 16, gap: 12 }, statRow: { flexDirection: 'row', gap: 12 }, stat: { flex: 1 }, statLabel: { color: theme.ink3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }, statValue: { color: theme.ink, fontSize: 26, fontWeight: '700', marginTop: 2 }, warning: { color: theme.warn, fontSize: 13, lineHeight: 18 },
  mainButton: { backgroundColor: theme.saffronDeep, borderRadius: 999, alignItems: 'center', paddingVertical: 16, marginTop: 24 }, mainButtonStop: { backgroundColor: theme.danger }, mainButtonText: { color: theme.ink, fontSize: 17, fontWeight: '800' }, message: { color: theme.ink, fontSize: 14, lineHeight: 20, marginTop: 8 }, pending: { color: theme.ink2, fontSize: 13 }, footnote: { color: theme.ink3, fontSize: 12, lineHeight: 18, marginTop: 24 },
  input: { borderWidth: 1, borderColor: theme.line, borderRadius: 10, color: theme.ink, paddingHorizontal: 12, paddingVertical: 11, marginTop: 6 }, inputDisabled: { color: theme.ink3, backgroundColor: theme.bg2 }, consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }, checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: theme.line }, checkboxActive: { backgroundColor: theme.saffronDeep, borderColor: theme.saffronDeep }, cancel: { color: theme.ink2, textAlign: 'center', padding: 14 },
});

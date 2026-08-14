import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { JourneyRecorder } from '@/journeyRecorder';
import type { EngineSnapshot } from '@/sensorEngine';
import { flushQueue, pendingCount, uploadOrQueue } from '@/upload';
import type { VehicleType } from '@/types';
import { GOOGLE_AUTH_ENABLED } from '@/config';
import {
  enterBetterRoads,
  exchangeGoogleToken,
  restoreUser,
  type UserProfile,
} from '@/auth';

// UI Components
import { SplashView } from '@/components/SplashView';
import { OnboardingView } from '@/components/OnboardingView';
import { JourneyDashboard } from '@/components/JourneyDashboard';
import { ProfileEditor } from '@/components/ProfileEditor';
import { FeedbackModal } from '@/components/FeedbackModal';

if (GOOGLE_AUTH_ENABLED) {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}

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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const recorderRef = useRef<JourneyRecorder | null>(null);

  // Restore existing session and flush offline queue on launch
  useEffect(() => {
    void (async () => {
      try {
        const restored = await restoreUser();
        setUser(restored);
        if (restored) await flushQueue();
        setPending(await pendingCount());
      } catch {
        // network or storage error on boot
      } finally {
        // Minimum smooth splash transition
        setTimeout(() => setBooting(false), 500);
      }
    })();
  }, []);

  // Poll snapshot during active journey recording
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const s = recorderRef.current?.snapshot();
      if (s) setSnap({ ...s });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const handleGoogleLogin = useCallback(async () => {
    try {
      setAuthError(null);
      setAuthLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'success') {
        const idToken = response.data.idToken;
        if (!idToken) throw new Error('Google did not return an ID token.');
        const profile = await exchangeGoogleToken(idToken);
        setUser(profile);
        await flushQueue();
        setPending(await pendingCount());
      }
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED') {
        setAuthError(e.message || 'Google sign-in failed.');
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleEnter = useCallback(async () => {
    try {
      setAuthError(null);
      setAuthLoading(true);
      const profile = await enterBetterRoads();
      setUser(profile);
      await flushQueue();
      setPending(await pendingCount());
    } catch (e) {
      setAuthError(
        e instanceof Error ? e.message : 'Could not enter BetterRoads.',
      );
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const startJourney = useCallback(async () => {
    setMessage(null);
    const hasPermission = await JourneyRecorder.requestPermissions();
    if (!hasPermission) {
      setMessage('Location permission is required to record road quality.');
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

    if (result === 'auth-expired') {
      setMessage(
        'Your session expired. The journey is saved; sign in again to upload it.',
      );
      setUser(null);
    } else if (result === 'rejected') {
      setMessage(
        'The server rejected this journey. It remains saved on this device; contact support before removing it.',
      );
    } else if (result === 'uploaded') {
      setMessage(
        `Journey uploaded — ${payload.segments.length} road segments, ${payload.events.length} events logged.`,
      );
    } else {
      setMessage(
        'Offline — journey saved to queue and will upload automatically.',
      );
    }

    setPhase('idle');
  }, []);

  // 1. Splash Screen
  if (booting) {
    return <SplashView statusText="Connecting..." />;
  }

  // 2. Onboarding Screen (if user is not signed in)
  if (!user) {
    return (
      <OnboardingView
        onEnter={() => void handleEnter()}
        onGoogleLogin={() => void handleGoogleLogin()}
        googleAuthEnabled={GOOGLE_AUTH_ENABLED}
        loading={authLoading}
        error={authError}
      />
    );
  }

  // 3. Profile Editor Screen
  if (editingProfile) {
    return (
      <ProfileEditor
        user={user}
        onSaved={(next) => {
          setUser(next);
          setEditingProfile(false);
        }}
        onDeleted={() => {
          setUser(null);
          setEditingProfile(false);
        }}
        onCancel={() => setEditingProfile(false)}
        onLogout={() => {
          setUser(null);
          setEditingProfile(false);
        }}
      />
    );
  }

  // 4. Main Journey Recording Dashboard
  return (
    <>
      <JourneyDashboard
        user={user}
        vehicle={vehicle}
        onSelectVehicle={setVehicle}
        recording={phase === 'recording'}
        uploading={phase === 'uploading'}
        snapshot={snap}
        pendingCount={pending}
        message={message}
        onStartJourney={() => void startJourney()}
        onStopJourney={() => void stopJourney()}
        onOpenProfile={() => setEditingProfile(true)}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />

      <FeedbackModal
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        user={user}
      />
    </>
  );
}

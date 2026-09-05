import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { INDIA_STATES } from '@/indiaLocations';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { JourneyRecorder, type CollectionRecorderSnapshot } from '@/journeyRecorder';
import { flushQueue as flushLegacyQueue, pendingCount as legacyPendingCount } from '@/upload';
import { collectionProfileIsCurrent, controlledCollectionIsAuthorized, flushCollectionQueue, pendingCollectionCount, uploadCollectionOrQueue } from '@/collection/queue';
import { profileFor } from '@/collection/vehicleProfiles';
import type { CollectionMode, VehicleType } from '@/types';
import { getDeviceUuid } from '@/deviceId';
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

async function detectUserLocation(): Promise<{
  stateCode: string | null;
  cityName: string | null;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { stateCode: null, cityName: null };
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const geo = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
    if (!geo || geo.length === 0) return { stateCode: null, cityName: null };
    const first = geo[0];
    if (!first) return { stateCode: null, cityName: null };
    const regionName = (first.region || first.subregion || '').trim();
    const cityName = (
      first.city ||
      first.subregion ||
      first.district ||
      ''
    ).trim() || null;

    const allStates = INDIA_STATES;
    const matchedState = allStates.find(
      (s) =>
        s.name.toLowerCase() === regionName.toLowerCase() ||
        s.isoCode.toLowerCase() === regionName.toLowerCase() ||
        (regionName.length > 3 &&
          s.name.toLowerCase().includes(regionName.toLowerCase())),
    );

    const stateCode = matchedState?.isoCode || null;
    return { stateCode, cityName };
  } catch {
    return { stateCode: null, cityName: null };
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [vehicle, setVehicle] = useState<VehicleType>('CAR');
  const [collectionMode, setCollectionMode] = useState<CollectionMode>('STANDARD');
  const [installationId, setInstallationId] = useState('');
  const [snap, setSnap] = useState<CollectionRecorderSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const initialProfile = profileFor('CAR');
  const [vehicleSubtype, setVehicleSubtype] = useState(initialProfile.subtypes[0]!);
  const [mountPosition, setMountPosition] = useState(initialProfile.mountPositions[0]!);
  const [vehicleMetadata, setVehicleMetadata] = useState<Record<string, string | number | boolean | null>>(
    defaultVehicleMetadata('CAR'),
  );

  const recorderRef = useRef<JourneyRecorder | null>(null);

  // Restore existing session and flush offline queue on launch
  useEffect(() => {
    void (async () => {
      try {
        setInstallationId(await getDeviceUuid());
        const restored = await restoreUser();
        setUser(restored);
        if (restored) {
          await flushLegacyQueue();
          await flushCollectionQueue();
        }
        setPending((await legacyPendingCount()) + pendingCollectionCount());
      } catch {
        // network or storage error on boot
      } finally {
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
      const detected = await detectUserLocation();
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'success') {
        const idToken = response.data.idToken;
        if (!idToken) throw new Error('Google did not return an ID token.');
        const profile = await exchangeGoogleToken(idToken);

        let initialCity = profile.city;
        if (detected.cityName && detected.stateCode) {
          initialCity = `${detected.cityName}, ${detected.stateCode}`;
        } else if (detected.stateCode) {
          initialCity = `, ${detected.stateCode}`;
        }

        const draftProfile: UserProfile = {
          ...profile,
          city: initialCity || profile.city,
        };

        setUser(draftProfile);
        setIsInitialSetup(true);
        setEditingProfile(true);
        await flushLegacyQueue();
        await flushCollectionQueue();
        setPending((await legacyPendingCount()) + pendingCollectionCount());
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

      // 1. Detect location on 3rd onboarding step to autofill draft profile
      const detected = await detectUserLocation();

      // 2. Create / restore contributor guest session
      const profile = await enterBetterRoads();

      // 3. Pre-populate detected location into draft profile
      let initialCity = profile.city;
      if (detected.cityName && detected.stateCode) {
        initialCity = `${detected.cityName}, ${detected.stateCode}`;
      } else if (detected.stateCode) {
        initialCity = `, ${detected.stateCode}`;
      }

      const draftProfile: UserProfile = {
        ...profile,
        city: initialCity || profile.city,
      };

      setUser(draftProfile);
      // Immediately open Profile Editor for onboarding setup
      setIsInitialSetup(true);
      setEditingProfile(true);
      await flushLegacyQueue();
      await flushCollectionQueue();
      setPending((await legacyPendingCount()) + pendingCollectionCount());
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
    const profile = profileFor(vehicle);
    if (!(await collectionProfileIsCurrent(vehicle, profile.profileVersion))) {
      setMessage('This vehicle collection profile has changed. Update the app before recording.');
      return;
    }
    if (collectionMode === 'CONTROLLED_RESEARCH' && !(await controlledCollectionIsAuthorized(vehicle))) {
      setMessage('This installation is not authorized for controlled research in the selected vehicle. Ask an administrator to authorize its installation UUID first.');
      return;
    }
    const hasPermission = await JourneyRecorder.requestPermissions();
    if (!hasPermission) {
      setMessage('Location permission is required to record road quality.');
      return;
    }
    const recorder = new JourneyRecorder({
      mode: collectionMode,
      vehicleClass: vehicle,
      vehicleSubtype,
      vehicleMetadata,
      mountPosition,
    });
    recorderRef.current = recorder;
    await recorder.start();
    setSnap(null);
    setPhase('recording');
  }, [collectionMode, mountPosition, vehicle, vehicleMetadata, vehicleSubtype]);

  const stopJourney = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setPhase('uploading');

    const prepared = await recorder.stop();
    recorderRef.current = null;

    if (!prepared) {
      setMessage('No GPS fix during this trip — nothing to upload.');
      setPhase('idle');
      return;
    }

    const result = await uploadCollectionOrQueue(prepared);
    setPending((await legacyPendingCount()) + pendingCollectionCount());

    if (result === 'auth-expired') {
      setMessage(
        'Your session expired. The journey is saved; sign in again to upload it.',
      );
      setUser(null);
    } else if (result === 'rejected') {
      setMessage(
        'The server rejected this journey. It will not be retried.',
      );
    } else if (result === 'quarantined') {
      setMessage('Journey received for diagnostics, but it did not affect public road scores.');
    } else if (result === 'uploaded') {
      setMessage(
        `Collection uploaded — ${prepared.payload.featureWindows.length} sensor windows received for research.`,
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

  // 3. Profile Editor Screen (opened immediately after onboarding or manually via profile pill)
  if (editingProfile) {
    return (
      <ProfileEditor
        user={user}
        isInitialSetup={isInitialSetup}
        onSaved={(next) => {
          setUser(next);
          setEditingProfile(false);
          setIsInitialSetup(false);
        }}
        onDeleted={() => {
          setUser(null);
          setEditingProfile(false);
          setIsInitialSetup(false);
        }}
        onCancel={() => {
          setEditingProfile(false);
          setIsInitialSetup(false);
        }}
        onLogout={() => {
          setUser(null);
          setEditingProfile(false);
          setIsInitialSetup(false);
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
        onSelectVehicle={(next) => {
          const profile = profileFor(next);
          setVehicle(next);
          setVehicleSubtype(profile.subtypes[0] ?? 'OTHER');
          setMountPosition(profile.mountPositions[0] ?? '');
          setVehicleMetadata(defaultVehicleMetadata(next));
          setCollectionMode('STANDARD');
        }}
        collectionMode={collectionMode}
        onSelectCollectionMode={setCollectionMode}
        installationId={installationId}
        vehicleSubtype={vehicleSubtype}
        onSelectVehicleSubtype={setVehicleSubtype}
        mountPosition={mountPosition}
        onSelectMountPosition={setMountPosition}
        recording={phase === 'recording'}
        uploading={phase === 'uploading'}
        snapshot={snap}
        pendingCount={pending}
        message={message}
        onStartJourney={() => void startJourney()}
        onStopJourney={() => void stopJourney()}
        onMarkRoadFeature={() => {
          if (recorderRef.current?.markRoadFeature()) setMessage('Research marker saved. Use markers only as a passenger or research operator.');
        }}
        onOpenProfile={() => {
          setIsInitialSetup(false);
          setEditingProfile(true);
        }}
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

function defaultVehicleMetadata(vehicle: VehicleType): Record<string, string> {
  if (vehicle === 'CAR') return { vehicleAgeBand: 'UNKNOWN' };
  if (vehicle === 'BIKE' || vehicle === 'AUTO_RICKSHAW') return { powertrain: 'UNKNOWN' };
  if (vehicle === 'BUS' || vehicle === 'TRUCK') return { loadBand: 'UNKNOWN' };
  return {};
}

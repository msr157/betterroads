import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { CollectionStartConfig } from '../journeyRecorder';

export type NativeSession = {
  id: string;
  config: CollectionStartConfig & { ownerId: number | null };
  startedAt: number;
  endedAt?: number;
  error?: string;
  running: boolean;
  lastSampleAt: number;
  lastLocationAt: number;
};
interface RecorderModule {
  start(config: string): Promise<string>;
  stop(): Promise<string | null>;
  status(): Promise<string | null>;
  read(offset: number): Promise<string>;
  clear(id: string): Promise<void>;
  mark(markerType: string): Promise<void>;
}
const module = Platform.OS === 'android' ? requireOptionalNativeModule<RecorderModule>('RoadRecorder') : null;
export function nativeRecorder(): RecorderModule {
  if (!module) throw new Error('Install the new Android build to use screen-off recording.');
  return module;
}
export async function nativeSession(): Promise<NativeSession | null> {
  if (Platform.OS !== 'android') return null;
  const value = await nativeRecorder().status();
  return value ? JSON.parse(value) as NativeSession : null;
}

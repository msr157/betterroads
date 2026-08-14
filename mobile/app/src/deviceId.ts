import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'betterroads.device_uuid';

let cached: string | null = null;

/**
 * Install-time device UUID — identifies an installation, while account
 * ownership is resolved exclusively from the authenticated upload session.
 * Minted once on first launch and persisted; a reinstall mints a new one,
 * which is acceptable: the server only uses it to group journeys.
 */
export async function getDeviceUuid(): Promise<string> {
  if (cached) return cached;
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const minted = Crypto.randomUUID();
  await AsyncStorage.setItem(KEY, minted);
  cached = minted;
  return minted;
}

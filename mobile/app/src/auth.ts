import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API_URL, APP_VERSION } from '@/config';
import { getDeviceUuid } from '@/deviceId';

const TOKEN_KEY = 'betterroads_user_token';
const USER_ID_KEY = 'betterroads_user_id';
const USER_PROFILE_KEY = 'betterroads_user_profile';

export type UserProfile = {
  id: number;
  publicId: string;
  username: string;
  name: string;
  email: string | null;
  googleLinked: boolean;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  genderSelfDescription: string | null;
  city: string | null;
  publicLeaderboard: boolean;
};

// Cross-platform safe storage (SecureStore on iOS/Android, AsyncStorage fallback for Web/Offline)
async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {}
  }
  await AsyncStorage.setItem(key, value);
}

async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') {
    try {
      const val = await SecureStore.getItemAsync(key);
      if (val) return val;
    } catch {}
  }
  return AsyncStorage.getItem(key);
}

async function deleteStorageItem(key: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }
  await AsyncStorage.removeItem(key);
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(
      new Error(body.error ?? `Request failed (${res.status}).`),
      { status: res.status },
    );
  }
  return body as T;
}

export const getToken = () => getStorageItem(TOKEN_KEY);

async function cacheUser(user: UserProfile): Promise<void> {
  await Promise.all([
    setStorageItem(USER_ID_KEY, String(user.id)),
    setStorageItem(USER_PROFILE_KEY, JSON.stringify(user)),
  ]);
}

async function cachedUser(): Promise<UserProfile | null> {
  const value = await getStorageItem(USER_PROFILE_KEY);
  if (!value) return null;
  try {
    const user = JSON.parse(value) as UserProfile;
    return Number.isInteger(user.id) &&
      typeof user.publicId === 'string' &&
      typeof user.username === 'string' &&
      typeof user.name === 'string'
      ? user
      : null;
  } catch {
    return null;
  }
}

export async function clearToken() {
  await Promise.all([
    deleteStorageItem(TOKEN_KEY),
    deleteStorageItem(USER_ID_KEY),
    deleteStorageItem(USER_PROFILE_KEY),
  ]);
}

export async function getCurrentUserId(): Promise<number | null> {
  const value = await getStorageItem(USER_ID_KEY);
  return value ? Number(value) : null;
}

export async function exchangeGoogleToken(idToken: string): Promise<UserProfile> {
  const result = await request<{ token: string; user: UserProfile }>(
    '/api/mobile/auth/google',
    { method: 'POST', body: JSON.stringify({ idToken }) },
  );
  await setStorageItem(TOKEN_KEY, result.token);
  await cacheUser(result.user);
  return result.user;
}

export async function enterBetterRoads(): Promise<UserProfile> {
  const deviceUuid = await getDeviceUuid();
  try {
    const result = await request<{ token: string; user: UserProfile }>(
      '/api/mobile/auth/guest',
      {
        method: 'POST',
        body: JSON.stringify({
          deviceUuid,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          model: Device.modelName ?? null,
          appVersion: APP_VERSION,
        }),
      },
    );
    await setStorageItem(TOKEN_KEY, result.token);
    await cacheUser(result.user);
    return result.user;
  } catch (error) {
    // If offline or previewing without backend CORS, restore cached or create local guest profile
    const existing = await cachedUser();
    if (existing) return existing;

    const cleanUuid = deviceUuid.replace(/[^a-zA-Z0-9]/g, '');
    const shortCode = (cleanUuid.slice(0, 6) || 'CONTRIB').toUpperCase();
    const fallbackUser: UserProfile = {
      id: 1001,
      publicId: `BR-${shortCode}`,
      username: `contributor_${shortCode.toLowerCase()}`,
      name: 'Contributor',
      email: null,
      googleLinked: false,
      dateOfBirth: null,
      age: null,
      gender: null,
      genderSelfDescription: null,
      city: null,
      publicLeaderboard: false,
    };
    await setStorageItem(TOKEN_KEY, `session_${cleanUuid}`);
    await cacheUser(fallbackUser);
    return fallbackUser;
  }
}

export async function linkGoogleToken(idToken: string): Promise<UserProfile> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in.');
  const user = (
    await request<{ user: UserProfile }>(
      '/api/mobile/auth/google/link',
      { method: 'POST', body: JSON.stringify({ idToken }) },
      token,
    )
  ).user;
  await cacheUser(user);
  return user;
}

export async function restoreUser(): Promise<UserProfile | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const user = (
      await request<{ user: UserProfile }>('/api/mobile/me', {}, token)
    ).user;
    await cacheUser(user);
    return user;
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      await clearToken();
      return null;
    }
    // Network outage or offline mode restores cached user
    return cachedUser();
  }
}

export async function updateProfile(
  profile: Omit<
    UserProfile,
    'id' | 'publicId' | 'age' | 'email' | 'googleLinked'
  >,
): Promise<UserProfile> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in.');
  try {
    const user = (
      await request<{ user: UserProfile }>(
        '/api/mobile/me',
        { method: 'PUT', body: JSON.stringify(profile) },
        token,
      )
    ).user;
    await cacheUser(user);
    return user;
  } catch (error) {
    // If offline/preview, update local cache
    const current = await cachedUser();
    if (current) {
      const updated: UserProfile = {
        ...current,
        ...profile,
      };
      await cacheUser(updated);
      return updated;
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  const token = await getToken();
  try {
    if (token) {
      await request('/api/mobile/auth/logout', { method: 'POST' }, token);
    }
  } catch {}
  await clearToken();
}

export async function deleteAccount(): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in.');
  try {
    await request(
      '/api/mobile/me',
      { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE' }) },
      token,
    );
  } catch {}
  await clearToken();
}

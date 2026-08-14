import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/config';

const TOKEN_KEY = 'betterroads_user_token';
const USER_ID_KEY = 'betterroads_user_id';
const USER_PROFILE_KEY = 'betterroads_user_profile';

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  genderSelfDescription: string | null;
  city: string | null;
  publicLeaderboard: boolean;
};

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? `Request failed (${res.status}).`), { status: res.status });
  return body as T;
}

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
async function cacheUser(user: UserProfile): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(USER_ID_KEY, String(user.id)),
    SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(user)),
  ]);
}

async function cachedUser(): Promise<UserProfile | null> {
  const value = await SecureStore.getItemAsync(USER_PROFILE_KEY);
  if (!value) return null;
  try {
    const user = JSON.parse(value) as UserProfile;
    return Number.isInteger(user.id) && typeof user.name === 'string' && typeof user.email === 'string' ? user : null;
  } catch {
    return null;
  }
}

export async function clearToken() { await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_ID_KEY), SecureStore.deleteItemAsync(USER_PROFILE_KEY)]); }
export async function getCurrentUserId(): Promise<number | null> { const value = await SecureStore.getItemAsync(USER_ID_KEY); return value ? Number(value) : null; }

export async function exchangeGoogleToken(idToken: string): Promise<UserProfile> {
  const result = await request<{ token: string; user: UserProfile }>('/api/mobile/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) });
  await SecureStore.setItemAsync(TOKEN_KEY, result.token);
  await cacheUser(result.user);
  return result.user;
}

export async function restoreUser(): Promise<UserProfile | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const user = (await request<{ user: UserProfile }>('/api/mobile/me', {}, token)).user;
    await cacheUser(user);
    return user;
  } catch (error) {
    if ((error as { status?: number }).status === 401) await clearToken();
    // A network outage must not lock an authenticated contributor out of
    // recording. The server will revalidate before any queued upload.
    return (error as { status?: number }).status === 401 ? null : cachedUser();
  }
}

export async function updateProfile(profile: Omit<UserProfile, 'id' | 'age' | 'email'>): Promise<UserProfile> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in.');
  const user = (await request<{ user: UserProfile }>('/api/mobile/me', { method: 'PUT', body: JSON.stringify(profile) }, token)).user;
  await cacheUser(user);
  return user;
}

export async function logout(): Promise<void> {
  const token = await getToken();
  try { if (token) await request('/api/mobile/auth/logout', { method: 'POST' }, token); } finally { await clearToken(); }
}

export async function deleteAccount(): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in.');
  await request('/api/mobile/me', { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE' }) }, token);
  await clearToken();
}

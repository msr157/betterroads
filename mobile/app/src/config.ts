/**
 * API origin. Production default; override in dev via EXPO_PUBLIC_API_URL
 * (e.g. EXPO_PUBLIC_API_URL=http://192.168.1.5:3000 npx expo start).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://betterroads.org';

export const TRAVELDATA_ENDPOINT = `${API_URL}/api/user/mobile/traveldata`;
export const COLLECTION_ENDPOINT = `${API_URL}/api/user/mobile/collection`;

export const APP_VERSION = '1.3.1';

export const RELEASE_CHANNEL = process.env.EXPO_PUBLIC_RELEASE_CHANNEL === 'test' ? 'test' : 'stable';
// Google Sign-In is now enabled on all channels (stable + test).
export const GOOGLE_AUTH_ENABLED = true;

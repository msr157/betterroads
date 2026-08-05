/**
 * API origin. Production default; override in dev via EXPO_PUBLIC_API_URL
 * (e.g. EXPO_PUBLIC_API_URL=http://192.168.1.5:3000 npx expo start).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://betterroads.org';

export const TRAVELDATA_ENDPOINT = `${API_URL}/api/user/mobile/traveldata`;

export const APP_VERSION = '0.1.0';

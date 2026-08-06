/**
 * India geography helpers.
 *
 * BetterRoads is an India-only product: the public map is locked to the
 * subcontinent and analytics attribute data to the nearest major city.
 * The bbox intentionally includes a margin around the mainland + islands
 * (Andaman & Nicobar, Lakshadweep) so border-city data isn't clipped.
 */

export const INDIA_BOUNDS = {
  minLat: 6.0,
  maxLat: 36.0,
  minLon: 68.0,
  maxLon: 97.5,
} as const;

export interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Intersect a requested bbox with India; null when fully outside. */
export function clampBboxToIndia(bbox: Bbox): Bbox | null {
  const clamped = {
    minLat: Math.max(bbox.minLat, INDIA_BOUNDS.minLat),
    maxLat: Math.min(bbox.maxLat, INDIA_BOUNDS.maxLat),
    minLon: Math.max(bbox.minLon, INDIA_BOUNDS.minLon),
    maxLon: Math.min(bbox.maxLon, INDIA_BOUNDS.maxLon),
  };
  if (clamped.minLat >= clamped.maxLat || clamped.minLon >= clamped.maxLon) return null;
  return clamped;
}

export function isInIndia(lat: number, lon: number): boolean {
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lon >= INDIA_BOUNDS.minLon &&
    lon <= INDIA_BOUNDS.maxLon
  );
}

export interface IndiaCity {
  name: string;
  state: string;
  lat: number;
  lon: number;
}

/**
 * Major Indian cities for nearest-city attribution. Coverage: every city
 * over ~1M plus state capitals. Journeys further than
 * NEAREST_CITY_MAX_KM from all of them fall back to "Other".
 */
export const INDIA_CITIES: IndiaCity[] = [
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lon: 72.8777 },
  { name: 'Delhi', state: 'Delhi', lat: 28.7041, lon: 77.1025 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639 },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567 },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873 },
  { name: 'Surat', state: 'Gujarat', lat: 21.1702, lon: 72.8311 },
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462 },
  { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lon: 80.3319 },
  { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lon: 79.0882 },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lon: 75.8577 },
  { name: 'Thane', state: 'Maharashtra', lat: 19.2183, lon: 72.9781 },
  { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185 },
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lon: 85.1376 },
  { name: 'Vadodara', state: 'Gujarat', lat: 22.3072, lon: 73.1812 },
  { name: 'Ghaziabad', state: 'Uttar Pradesh', lat: 28.6692, lon: 77.4538 },
  { name: 'Ludhiana', state: 'Punjab', lat: 30.901, lon: 75.8573 },
  { name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lon: 78.0081 },
  { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lon: 73.7898 },
  { name: 'Faridabad', state: 'Haryana', lat: 28.4089, lon: 77.3178 },
  { name: 'Meerut', state: 'Uttar Pradesh', lat: 28.9845, lon: 77.7064 },
  { name: 'Rajkot', state: 'Gujarat', lat: 22.3039, lon: 70.8022 },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lon: 82.9739 },
  { name: 'Srinagar', state: 'Jammu & Kashmir', lat: 34.0837, lon: 74.7973 },
  { name: 'Aurangabad', state: 'Maharashtra', lat: 19.8762, lon: 75.3433 },
  { name: 'Dhanbad', state: 'Jharkhand', lat: 23.7957, lon: 86.4304 },
  { name: 'Amritsar', state: 'Punjab', lat: 31.634, lon: 74.8723 },
  { name: 'Navi Mumbai', state: 'Maharashtra', lat: 19.033, lon: 73.0297 },
  { name: 'Prayagraj', state: 'Uttar Pradesh', lat: 25.4358, lon: 81.8463 },
  { name: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lon: 85.3096 },
  { name: 'Howrah', state: 'West Bengal', lat: 22.5958, lon: 88.2636 },
  { name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lon: 76.9558 },
  { name: 'Jabalpur', state: 'Madhya Pradesh', lat: 23.1815, lon: 79.9864 },
  { name: 'Gwalior', state: 'Madhya Pradesh', lat: 26.2183, lon: 78.1828 },
  { name: 'Vijayawada', state: 'Andhra Pradesh', lat: 16.5062, lon: 80.648 },
  { name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lon: 73.0243 },
  { name: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lon: 78.1198 },
  { name: 'Raipur', state: 'Chhattisgarh', lat: 21.2514, lon: 81.6296 },
  { name: 'Kota', state: 'Rajasthan', lat: 25.2138, lon: 75.8648 },
  { name: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lon: 76.7794 },
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lon: 91.7362 },
  { name: 'Solapur', state: 'Maharashtra', lat: 17.6599, lon: 75.9064 },
  { name: 'Hubballi-Dharwad', state: 'Karnataka', lat: 15.3647, lon: 75.124 },
  { name: 'Mysuru', state: 'Karnataka', lat: 12.2958, lon: 76.6394 },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu', lat: 10.7905, lon: 78.7047 },
  { name: 'Bareilly', state: 'Uttar Pradesh', lat: 28.367, lon: 79.4304 },
  { name: 'Aligarh', state: 'Uttar Pradesh', lat: 27.8974, lon: 78.088 },
  { name: 'Tiruppur', state: 'Tamil Nadu', lat: 11.1085, lon: 77.3411 },
  { name: 'Moradabad', state: 'Uttar Pradesh', lat: 28.8386, lon: 78.7733 },
  { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lon: 85.8245 },
  { name: 'Salem', state: 'Tamil Nadu', lat: 11.6643, lon: 78.146 },
  { name: 'Warangal', state: 'Telangana', lat: 17.9689, lon: 79.5941 },
  { name: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lon: 76.9366 },
  { name: 'Guntur', state: 'Andhra Pradesh', lat: 16.3067, lon: 80.4365 },
  { name: 'Bhiwandi', state: 'Maharashtra', lat: 19.3009, lon: 73.0588 },
  { name: 'Saharanpur', state: 'Uttar Pradesh', lat: 29.968, lon: 77.5552 },
  { name: 'Gorakhpur', state: 'Uttar Pradesh', lat: 26.7606, lon: 83.3732 },
  { name: 'Bikaner', state: 'Rajasthan', lat: 28.0229, lon: 73.3119 },
  { name: 'Amravati', state: 'Maharashtra', lat: 20.9374, lon: 77.7796 },
  { name: 'Noida', state: 'Uttar Pradesh', lat: 28.5355, lon: 77.391 },
  { name: 'Jamshedpur', state: 'Jharkhand', lat: 22.8046, lon: 86.2029 },
  { name: 'Bhilai', state: 'Chhattisgarh', lat: 21.1938, lon: 81.3509 },
  { name: 'Cuttack', state: 'Odisha', lat: 20.4625, lon: 85.8828 },
  { name: 'Firozabad', state: 'Uttar Pradesh', lat: 27.1592, lon: 78.3957 },
  { name: 'Kochi', state: 'Kerala', lat: 9.9312, lon: 76.2673 },
  { name: 'Nellore', state: 'Andhra Pradesh', lat: 14.4426, lon: 79.9865 },
  { name: 'Bhavnagar', state: 'Gujarat', lat: 21.7645, lon: 72.1519 },
  { name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lon: 78.0322 },
  { name: 'Durgapur', state: 'West Bengal', lat: 23.5204, lon: 87.3119 },
  { name: 'Asansol', state: 'West Bengal', lat: 23.6739, lon: 86.9524 },
  { name: 'Rourkela', state: 'Odisha', lat: 22.2604, lon: 84.8536 },
  { name: 'Nanded', state: 'Maharashtra', lat: 19.1383, lon: 77.321 },
  { name: 'Kolhapur', state: 'Maharashtra', lat: 16.705, lon: 74.2433 },
  { name: 'Ajmer', state: 'Rajasthan', lat: 26.4499, lon: 74.6399 },
  { name: 'Akola', state: 'Maharashtra', lat: 20.7002, lon: 77.0082 },
  { name: 'Gulbarga', state: 'Karnataka', lat: 17.3297, lon: 76.8343 },
  { name: 'Jamnagar', state: 'Gujarat', lat: 22.4707, lon: 70.0577 },
  { name: 'Ujjain', state: 'Madhya Pradesh', lat: 23.1765, lon: 75.7885 },
  { name: 'Loni', state: 'Uttar Pradesh', lat: 28.7515, lon: 77.288 },
  { name: 'Siliguri', state: 'West Bengal', lat: 26.7271, lon: 88.3953 },
  { name: 'Jhansi', state: 'Uttar Pradesh', lat: 25.4484, lon: 78.5685 },
  { name: 'Mangaluru', state: 'Karnataka', lat: 12.9141, lon: 74.856 },
  { name: 'Erode', state: 'Tamil Nadu', lat: 11.341, lon: 77.7172 },
  { name: 'Belagavi', state: 'Karnataka', lat: 15.8497, lon: 74.4977 },
  { name: 'Tirunelveli', state: 'Tamil Nadu', lat: 8.7139, lon: 77.7567 },
  { name: 'Gaya', state: 'Bihar', lat: 24.7914, lon: 85.0002 },
  { name: 'Jalandhar', state: 'Punjab', lat: 31.326, lon: 75.5762 },
  { name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lon: 73.7125 },
  { name: 'Gurugram', state: 'Haryana', lat: 28.4595, lon: 77.0266 },
  { name: 'Panaji', state: 'Goa', lat: 15.4909, lon: 73.8278 },
  { name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lon: 77.1734 },
  { name: 'Puducherry', state: 'Puducherry', lat: 11.9416, lon: 79.8083 },
  { name: 'Imphal', state: 'Manipur', lat: 24.817, lon: 93.9368 },
  { name: 'Shillong', state: 'Meghalaya', lat: 25.5788, lon: 91.8933 },
  { name: 'Aizawl', state: 'Mizoram', lat: 23.7307, lon: 92.7173 },
  { name: 'Kohima', state: 'Nagaland', lat: 25.6751, lon: 94.1086 },
  { name: 'Itanagar', state: 'Arunachal Pradesh', lat: 27.0844, lon: 93.6053 },
  { name: 'Gangtok', state: 'Sikkim', lat: 27.3389, lon: 88.6065 },
  { name: 'Agartala', state: 'Tripura', lat: 23.8315, lon: 91.2868 },
  { name: 'Port Blair', state: 'Andaman & Nicobar', lat: 11.6234, lon: 92.7265 },
];

const NEAREST_CITY_MAX_KM = 60;
const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Nearest known city within 60 km, else null ("Other"). */
export function nearestCity(lat: number, lon: number): IndiaCity | null {
  let best: IndiaCity | null = null;
  let bestKm = NEAREST_CITY_MAX_KM;
  for (const city of INDIA_CITIES) {
    // Cheap prefilter: 1° ≈ 111 km, skip cities clearly out of range.
    if (Math.abs(city.lat - lat) > 0.6 || Math.abs(city.lon - lon) > 0.65) continue;
    const km = haversineKm(lat, lon, city.lat, city.lon);
    if (km < bestKm) {
      bestKm = km;
      best = city;
    }
  }
  return best;
}

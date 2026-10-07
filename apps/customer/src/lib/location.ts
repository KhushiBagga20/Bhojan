// Asking the device where it is. One function for iOS, Android and the web;
// every failure comes back as a reason a screen can explain in plain words.
// Nothing here stores or sends the location: the caller decides what to do with it.
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface Coordinates {
  latitude: number;
  longitude: number;
  /** How precise the device said the reading was, in metres. */
  accuracy: number | null;
}

/**
 * denied       the person (or their settings) said no
 * unavailable  location services are off, or the device could not work it out
 * timeout      the device took too long
 * unsupported  this browser cannot share a location (for example, not on https)
 */
export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export type LocationResult = ({ ok: true } & Coordinates) | { ok: false; reason: LocationFailure };

const TIMEOUT_MS = 20_000;

export function getCurrentCoordinates(): Promise<LocationResult> {
  return Platform.OS === 'web' ? fromBrowser() : fromDevice();
}

function fromBrowser(): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation || globalThis.isSecureContext === false) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        }),
      (error) =>
        resolve({
          ok: false,
          reason:
            error.code === error.PERMISSION_DENIED
              ? 'denied'
              : error.code === error.TIMEOUT
                ? 'timeout'
                : 'unavailable',
        }),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 60_000 },
    );
  });
}

async function fromDevice(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'denied' };
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'unavailable' };
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!position) return { ok: false, reason: 'timeout' };
    return {
      ok: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** What to tell someone when their location could not be read, and what they can do about it. */
export function describeLocationFailure(reason: LocationFailure): { title: string; message: string } {
  switch (reason) {
    case 'denied':
      return {
        title: 'Location is switched off for Bhojan',
        message:
          'To find kitchens near you, allow location for Bhojan in your phone or browser settings, then try again. Or choose your area instead.',
      };
    case 'timeout':
      return {
        title: 'That took too long',
        message: 'Your phone could not find where you are in time. Please try again, or choose your area instead.',
      };
    case 'unsupported':
      return {
        title: "Location isn't available here",
        message: 'This browser cannot share your location with Bhojan. Please choose your area instead.',
      };
    default:
      return {
        title: "We couldn't find where you are",
        message: 'Please check that location (GPS) is switched on, then try again. Or choose your area instead.',
      };
  }
}

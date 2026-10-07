// Reads where this device is, with the browser's permission. Used once: to set
// the kitchen's location while the cook is in their kitchen.

export type LocationReading =
  { ok: true; latitude: number; longitude: number; accuracy: number } | { ok: false; problem: string };

const PROBLEMS = {
  denied:
    'Location is blocked for this page. Allow location for Bhojan in your browser’s settings (the padlock next to the web address), then try again.',
  unavailable: 'Your device could not work out where it is. Check that location is switched on, then try again.',
  timeout: 'That took too long. Please try again.',
  unsupported:
    'This browser cannot share its location with this page. Open your dashboard on a phone, or in a browser on a secure (https) address, and try again.',
};

export function readBrowserLocation(): Promise<LocationReading> {
  if (typeof navigator === 'undefined' || !navigator.geolocation || !window.isSecureContext) {
    return Promise.resolve({ ok: false, problem: PROBLEMS.unsupported });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ ok: true, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (error) =>
        resolve({
          ok: false,
          problem:
            error.code === error.PERMISSION_DENIED
              ? PROBLEMS.denied
              : error.code === error.TIMEOUT
                ? PROBLEMS.timeout
                : PROBLEMS.unavailable,
        }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

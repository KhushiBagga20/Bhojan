import { useState } from 'react';
import { announce } from '@/lib/a11y';
import { describeLocationFailure, getCurrentCoordinates, type Coordinates, type LocationFailure } from '@/lib/location';

/** Asks the device where it is, and keeps what a screen needs to show while and after it does. */
export function useCurrentLocation() {
  const [finding, setFinding] = useState(false);
  const [failure, setFailure] = useState<LocationFailure | null>(null);

  /** Resolves with the coordinates, or null (with `failure` set) if they could not be read. */
  const find = async (): Promise<Coordinates | null> => {
    setFinding(true);
    setFailure(null);
    const result = await getCurrentCoordinates();
    setFinding(false);
    if (result.ok) return { latitude: result.latitude, longitude: result.longitude, accuracy: result.accuracy };
    setFailure(result.reason);
    announce(describeLocationFailure(result.reason).title);
    return null;
  };

  return { finding, failure: failure ? describeLocationFailure(failure) : null, find };
}

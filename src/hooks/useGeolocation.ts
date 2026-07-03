import { useCallback, useState } from 'react';
import type { GeoPointLite } from '../types';

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPointLite | null>(null);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle');

  const requestPosition = useCallback(() => new Promise<GeoPointLite | null>((resolve) => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      resolve(null);
      return;
    }
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        setPosition(gps);
        setStatus('granted');
        resolve(gps);
      },
      () => {
        setStatus('denied');
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  }), []);

  return { position, status, requestPosition };
}

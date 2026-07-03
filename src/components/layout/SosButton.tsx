import { useEffect, useRef, useState } from 'react';
import { Siren, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { triggerSos } from '../../services/firestoreService';
import { canVibrate } from '../../utils/security';
import { Button } from '../ui/Button';

export function SosButton() {
  const { profile } = useAuth();
  const { requestPosition } = useGeolocation();
  const [armed, setArmed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const holdTimer = useRef<number | null>(null);

  const startHold = () => {
    if (!profile) return;
    holdTimer.current = window.setTimeout(() => {
      setArmed(true);
      setCountdown(4);
      if (canVibrate()) navigator.vibrate([100, 60, 100]);
    }, 2200);
  };

  const stopHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
  };

  useEffect(() => {
    if (!armed || countdown <= 0) return;
    const id = window.setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => window.clearTimeout(id);
  }, [armed, countdown]);

  useEffect(() => {
    if (!armed || countdown !== 0 || sending || !profile) return;
    const run = async () => {
      if (!navigator.onLine) {
        alert('Réseau indisponible — appelez directement le QG ou les secours.');
        setArmed(false);
        return;
      }
      setSending(true);
      try {
        const gps = await requestPosition();
        await triggerSos({ agent: profile, gps });
        alert('Alerte envoyée. QG notifié. Restez en sécurité.');
      } catch (e) {
        alert('Alerte non transmise. Appelez directement le QG ou les secours.');
      } finally {
        setSending(false);
        setArmed(false);
      }
    };
    run();
  }, [armed, countdown, profile, requestPosition, sending]);

  if (!profile || profile.role !== 'agent') return null;

  return (
    <>
      <button
        aria-label="Maintenir pour déclencher SOS"
        onMouseDown={startHold}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={startHold}
        onTouchEnd={stopHold}
        className="fixed bottom-24 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/15 bg-alert text-white shadow-premium md:bottom-8"
      >
        <Siren className="h-7 w-7" />
      </button>

      {armed && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-obsidian/95 p-5">
          <div className="max-w-sm rounded-[2rem] border border-alert/50 bg-alert/10 p-6 text-center">
            <Siren className="mx-auto h-14 w-14 text-alert" />
            <h2 className="mt-4 text-2xl font-extrabold">Alerte SOS prête</h2>
            <p className="mt-2 text-sm text-metal">Déclenchement dans {countdown}s. Annule si c’est une erreur.</p>
            <Button variant="ghost" className="mt-5 w-full" onClick={() => setArmed(false)}>
              <X className="mr-2 inline h-4 w-4" /> Annuler
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

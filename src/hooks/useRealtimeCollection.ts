import { useEffect, useState } from 'react';
import { onSnapshot, type Query } from 'firebase/firestore';

export function useRealtimeCollection<T>(queryRef: Query, deps: unknown[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(queryRef, (snap) => {
      setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
      setLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}

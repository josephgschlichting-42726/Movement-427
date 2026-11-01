import Dexie from 'dexie';
import { useEffect, useRef, useState } from 'react';

/**
 * Like dexie-react-hooks' useLiveQuery, but re-runs on *any* local database write.
 *
 * Why: Dexie's fine-grained tracking loses track of tables read after awaiting one of our
 * own async helpers (they return native promises), so screens built on loadPlanDays /
 * loadSession silently stopped updating. Our data is small and local, so re-running on
 * every write is cheap and always correct. Bursts of writes are coalesced into one frame,
 * and out-of-order results are discarded.
 *
 * Returns undefined until the first result arrives.
 */
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTick((t) => t + 1));
    };
    Dexie.on('storagemutated', onChange);
    return () => {
      cancelAnimationFrame(frame);
      Dexie.on('storagemutated').unsubscribe(onChange);
    };
  }, []);

  useEffect(() => {
    const id = ++seq.current;
    Promise.resolve(query()).then(
      (v) => id === seq.current && setValue(() => v),
      (err) => console.error('query failed', err),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return value;
}

import { useEffect, useRef, useState } from "react";

/** Whole seconds elapsed since the hook first mounted, ticking every second. */
export function useElapsed(): number {
  const start = useRef(Date.now());
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return seconds;
}

/** Whole seconds remaining until `iso`, clamped at 0. Null when no deadline. */
export function useCountdown(iso: string | undefined): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    computeRemaining(iso),
  );

  useEffect(() => {
    if (!iso) {
      setRemaining(null);
      return;
    }
    setRemaining(computeRemaining(iso));
    const id = setInterval(() => setRemaining(computeRemaining(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  return remaining;
}

function computeRemaining(iso: string | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_STORE_SETTINGS, type StoreSettingsData } from '@/lib/storeSettings';

// One request per page load, shared by the banner, footer and order form.
let cached: StoreSettingsData | null = null;
let inflight: Promise<StoreSettingsData> | null = null;

function fetchSettings(): Promise<StoreSettingsData> {
  if (!inflight) {
    inflight = fetch('/api/store-settings')
      .then((r) => (r.ok ? r.json() : DEFAULT_STORE_SETTINGS))
      .catch(() => DEFAULT_STORE_SETTINGS)
      .then((s: StoreSettingsData) => (cached = s));
  }
  return inflight;
}

// Returns null until loaded, so nothing flashes "closed" by mistake
export function useStoreSettings(): StoreSettingsData | null {
  const [s, setS] = useState<StoreSettingsData | null>(cached);
  useEffect(() => {
    let alive = true;
    fetchSettings().then((v) => { if (alive) setS(v); });
    return () => { alive = false; };
  }, []);
  return s;
}

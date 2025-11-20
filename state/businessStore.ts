import { useEffect, useState } from 'react';
import { hasBusinessProfile as fetchHasBusinessProfile } from '@/lib/businessProfile';

type BusinessState = {
  hasBusinessProfile: boolean;
};

let listeners: Array<() => void> = [];
let state: BusinessState = {
  hasBusinessProfile: false,
};

function updateState(updates: Partial<BusinessState>) {
  state = { ...state, ...updates };
  listeners.forEach((l) => l());
}

async function refreshHasBusinessProfile(): Promise<boolean> {
  try {
    const result = await fetchHasBusinessProfile();
    updateState({ hasBusinessProfile: result });
    return result;
  } catch {
    updateState({ hasBusinessProfile: false });
    return false;
  }
}

// Initial refresh on client
if (typeof window !== 'undefined') {
  refreshHasBusinessProfile().catch(() => {});
}

export function useBusinessStore() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    ...state,
    setHasBusinessProfile: (value: boolean) => updateState({ hasBusinessProfile: value }),
    refreshHasBusinessProfile,
  };
}



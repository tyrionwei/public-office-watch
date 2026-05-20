import type { PublicDataProvider } from './publicDataProvider';
import { mockPublicDataProvider } from './mockPublicDataProvider';
import { getPublicDataProviderMode, getSupabasePublicEnv } from './supabaseEnv';
import { refreshSupabasePublicDataSnapshot, supabasePublicDataProvider } from './supabasePublicDataProvider';

export const publicDataReadyEvent = 'public-data-ready';

function isLocalToggleAllowed() {
  return import.meta.env.DEV;
}

export function createPublicDataProvider(): PublicDataProvider {
  if (getPublicDataProviderMode() !== 'supabase') {
    return mockPublicDataProvider;
  }

  if (!isLocalToggleAllowed()) {
    return mockPublicDataProvider;
  }

  const env = getSupabasePublicEnv();

  if (!env) {
    return mockPublicDataProvider;
  }

  void refreshSupabasePublicDataSnapshot().then(() => {
    window.dispatchEvent(new Event(publicDataReadyEvent));
  });
  return supabasePublicDataProvider;
}

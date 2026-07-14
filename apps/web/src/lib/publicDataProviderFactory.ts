import type { PublicDataProvider } from './publicDataProvider';
import { mockPublicDataProvider } from './mockPublicDataProvider';
import { getPublicDataProviderMode, getSupabasePublicEnv } from './supabaseEnv';

export const publicDataReadyEvent = 'public-data-ready';

let activePublicDataProvider: PublicDataProvider = mockPublicDataProvider;
let configuredProviderPromise: Promise<PublicDataProvider> | null = null;

function isSupabaseProviderAllowed() {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_SUPABASE_PROVIDER === 'true';
}

function shouldUseSupabaseProvider() {
  if (getPublicDataProviderMode() !== 'supabase') {
    return false;
  }

  if (!isSupabaseProviderAllowed()) {
    return false;
  }

  return getSupabasePublicEnv() !== null;
}

export function createPublicDataProvider(): PublicDataProvider {
  return new Proxy({} as PublicDataProvider, {
    get(_target, property: keyof PublicDataProvider) {
      const value = activePublicDataProvider[property];
      return typeof value === 'function' ? value.bind(activePublicDataProvider) : value;
    },
  });
}

export function refreshConfiguredPublicDataProvider(): Promise<PublicDataProvider> {
  if (!shouldUseSupabaseProvider()) {
    activePublicDataProvider = mockPublicDataProvider;
    return Promise.resolve(activePublicDataProvider);
  }

  configuredProviderPromise ??= import('./supabasePublicDataProvider')
    .then(async (module) => {
      activePublicDataProvider = module.supabasePublicDataProvider;
      await module.refreshSupabasePublicDataSnapshot();
      return activePublicDataProvider;
    })
    .catch((error: unknown) => {
      configuredProviderPromise = null;
      throw error;
    });

  return configuredProviderPromise;
}

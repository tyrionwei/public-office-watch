import type { PublicDataProvider } from './publicDataProvider';
import { mockPublicDataProvider } from './mockPublicDataProvider';
import { getPublicDataProviderMode, getSupabasePublicEnv } from './supabaseEnv';

export const publicDataReadyEvent = 'public-data-ready';

let activePublicDataProvider: PublicDataProvider = mockPublicDataProvider;
let configuredProviderPromise: Promise<PublicDataProvider> | null = null;

function isSupabaseProviderAllowed() {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_SUPABASE_PROVIDER === 'true';
}

function isPublishedProviderAllowed() {
  return import.meta.env.VITE_ENABLE_PUBLISHED_PROVIDER === 'true';
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
  const mode = getPublicDataProviderMode();
  const supabaseEnv = getSupabasePublicEnv();

  if (mode === 'mock' || !supabaseEnv) {
    activePublicDataProvider = mockPublicDataProvider;
    return Promise.resolve(activePublicDataProvider);
  }

  if (mode === 'published') {
    if (!isPublishedProviderAllowed()) {
      activePublicDataProvider = mockPublicDataProvider;
      return Promise.resolve(activePublicDataProvider);
    }

    configuredProviderPromise ??= import('./configuredPublishedPublicDataProvider')
      .then(async (module) => {
        const assembly = module.getConfiguredPublishedPublicDataProvider();
        await assembly.refresh();
        activePublicDataProvider = assembly.provider;
        return activePublicDataProvider;
      })
      .catch((error: unknown) => {
        configuredProviderPromise = null;
        throw error;
      });
  } else {
    if (!isSupabaseProviderAllowed()) {
      activePublicDataProvider = mockPublicDataProvider;
      return Promise.resolve(activePublicDataProvider);
    }

    configuredProviderPromise ??= import('./supabasePublicDataProvider')
      .then(async (module) => {
        await module.refreshSupabasePublicDataSnapshot();
        activePublicDataProvider = module.supabasePublicDataProvider;
        return activePublicDataProvider;
      })
      .catch((error: unknown) => {
        configuredProviderPromise = null;
        throw error;
      });
  }

  return configuredProviderPromise;
}

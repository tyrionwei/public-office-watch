import type { PublicDataProvider } from './publicDataProvider';
import { mockPublicDataProvider } from './mockPublicDataProvider';
import { getPublicDataProviderMode, getSupabasePublicEnv } from './supabaseEnv';

export const publicDataReadyEvent = 'public-data-ready';

let activePublicDataProvider: PublicDataProvider = mockPublicDataProvider;
let configuredProviderPromise: Promise<PublicDataProvider> | null = null;

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

  if (!isPublishedProviderAllowed()) {
    activePublicDataProvider = mockPublicDataProvider;
    return Promise.resolve(activePublicDataProvider);
  }

  configuredProviderPromise ??= import('./configuredPublishedPublicDataProvider')
    .then((module) => {
      const assembly = module.getConfiguredPublishedPublicDataProvider();
      activePublicDataProvider = assembly.provider;
      return activePublicDataProvider;
    })
    .catch((error: unknown) => {
      configuredProviderPromise = null;
      throw error;
    });

  return configuredProviderPromise;
}

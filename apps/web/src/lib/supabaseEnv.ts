type PublicDataProviderMode = 'mock' | 'supabase';

type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

function looksLikeServiceRole(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes('service_role') || normalized.includes('service-role');
}

export function getPublicDataProviderMode(): PublicDataProviderMode {
  const rawMode = import.meta.env.VITE_PUBLIC_DATA_PROVIDER;

  if (rawMode === 'supabase') {
    return 'supabase';
  }

  return 'mock';
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  if (looksLikeServiceRole(anonKey)) {
    throw new Error('Invalid frontend Supabase key configuration. Frontend access must use an anon public key.');
  }

  return { url, anonKey };
}

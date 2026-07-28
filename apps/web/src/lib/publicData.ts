import { validatePublicDataBoundary } from './mockPublicDataProvider';
import { createPublicDataProvider } from './publicDataProviderFactory';

// Local tests and production builds validate their Supabase environments separately.
// Mock remains the fallback only when Supabase is not explicitly configured.
// Frontend may only read approved public views through anon key.
validatePublicDataBoundary();

export const publicDataProvider = createPublicDataProvider();

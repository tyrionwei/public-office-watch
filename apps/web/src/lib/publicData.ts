import { validatePublicDataBoundary } from './mockPublicDataProvider';
import { createPublicDataProvider } from './publicDataProviderFactory';

// Mock remains the safe default.
// Supabase provider is local-only until the readiness checklist is completed.
// Frontend may only read approved public views through anon key.
validatePublicDataBoundary();

export const publicDataProvider = createPublicDataProvider();

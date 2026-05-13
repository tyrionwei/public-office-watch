import { mockPublicDataProvider, validatePublicDataBoundary } from './mockPublicDataProvider';
import { getPublicDataProviderMode } from './supabaseEnv';

// 目前使用 mock provider。
// 未來只能改接 Supabase public views。
// 不得讀 raw / staging / candidate review tables。
// Supabase provider skeleton exists but is intentionally not enabled in Phase 4I.
// Production wiring must only read public views with anon key.
validatePublicDataBoundary();
void getPublicDataProviderMode();

export const publicDataProvider = mockPublicDataProvider;

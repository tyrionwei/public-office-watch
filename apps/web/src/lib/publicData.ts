import { mockPublicDataProvider, validatePublicDataBoundary } from './mockPublicDataProvider';

// 目前使用 mock provider。
// 未來只能改接 Supabase public views。
// 不得讀 raw / staging / candidate review tables。
validatePublicDataBoundary();

export const publicDataProvider = mockPublicDataProvider;

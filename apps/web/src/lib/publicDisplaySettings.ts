import { getPublicDataProviderMode } from './supabaseEnv';
import { getSupabasePublicClient } from './supabasePublicClient';
import { parsePublicDisplaySettings } from './publicBirthDate';

export const publicDisplaySettingsChangedEvent = 'pow-public-display-settings-changed';

export async function loadPublicDisplaySettings() {
  if (getPublicDataProviderMode() === 'mock') {
    return parsePublicDisplaySettings({ birth_date_year_only: false, revision: 0, updated_at: '2026-09-09T00:00:00Z' });
  }
  const client = getSupabasePublicClient();
  if (!client) throw new Error('Public display settings unavailable');
  const { data, error } = await client.from('site_display_settings')
    .select('birth_date_year_only,revision,updated_at').eq('id', 1).single();
  if (error) throw error;
  return parsePublicDisplaySettings(data);
}

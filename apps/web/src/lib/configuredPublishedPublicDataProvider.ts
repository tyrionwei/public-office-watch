import { createPublishedPublicDataBridge } from './publishedPublicDataBridge.ts';
import {
  createPublishedPublicDataProvider,
  type PublishedProviderAssembly,
} from './publishedPublicDataProvider.ts';
import {
  createPublishedReadAdapter,
  type PublishedSchemaClient,
} from './publishedReadAdapter.ts';
import { getSupabasePublicClient } from './supabasePublicClient';

let configuredAssembly: PublishedProviderAssembly | null = null;

export function getConfiguredPublishedPublicDataProvider() {
  if (configuredAssembly) return configuredAssembly;

  const client = getSupabasePublicClient();
  if (!client) {
    throw new Error('Published provider requires a configured frontend Supabase client.');
  }

  const adapter = createPublishedReadAdapter(client as unknown as PublishedSchemaClient);
  configuredAssembly = createPublishedPublicDataProvider(createPublishedPublicDataBridge(adapter));
  return configuredAssembly;
}

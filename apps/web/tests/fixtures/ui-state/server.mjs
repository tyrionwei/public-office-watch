import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

export async function startStateFixture() {
  const fixture = dirname(fileURLToPath(import.meta.url));
  const web = resolve(fixture, '../../..');
  const out = await mkdtemp(resolve(tmpdir(), 'pow-ui-state-'));
  const modules = {
    i18n: `export const useI18n=()=>({language:'en',t:(key,values)=>key+(values?' '+Object.values(values).join(' '):'')});`,
    'lib/personData': `export const toPartyThemeKey=()=> 'other';
      export const normalizePartyLabel=value=>value??'';
      export const getPreviousPartyName=()=>null;
      export const getPersonDisplayPosition=person=>person.position??'';`,
    'components/ShareButton': `import React from 'react';export const ShareButton=()=>window.__pageFailures?React.createElement('button',null,'Share fixture'):null;`,
    'components/GlobalChatWidget': `export const openGlobalChatEvent='fixture-open-chat';`,
    'components/AppShell': `import React from 'react';export const AppShell=({children})=>React.createElement('main',null,children);`,
    'lib/publicDataProviderFactory': `export const refreshConfiguredPublicDataProvider=async()=>{};export const publicDataReadyEvent='fixture-data-ready';`,
    'lib/publicData': `const baseProvider={getPersonById:id=>window.__metadataState?.people[id],getPartyBySlug:()=>null,loadRegionDirectory:()=>window.__uiState.loadRegions(),getStageRegions:()=>[
      {id:'taipei-city',label:'臺北市',stageLabel:'63000',level:'county_city'},
      {id:'new-taipei-city',label:'新北市',stageLabel:'65000',level:'county_city'}],loadPollingPlaces:async()=>[],
      loadPartyDirectory:async()=>{},getParties:()=>[{name:'TEST'}],
      searchPublicRecords:query=>window.__publicFlows.search(query),
      loadPeoplePage:(filters,page,size)=>window.__publicFlows.people(filters,page,size)};
      export const publicDataProvider=new Proxy(baseProvider,{get(target,key){return window.__pageFailures?.provider[key]??target[key]}});`,
    'lib/platformFulfillment': `export const platformFulfillmentStatuses=['fulfilled','in_progress','not_fulfilled','insufficient_information'];
      export const platformFulfillmentSummaryMinimumVotes=20;export const fulfillmentPercent=(n,t)=>t?n/t*100:0;
      export const summarizePlatformFulfillment=()=>({counts:{fulfilled:0,in_progress:0,not_fulfilled:0,insufficient_information:0},totalCount:0,totalVoteCount:0,qualifyingItemCount:0,itemCount:1,ready:false});
      export const loadPlatformFulfillment=id=>window.__uiState.load(id);
      export const submitPlatformFulfillmentVote=(...args)=>window.__uiState.write('submit',...args);
      export const withdrawPlatformFulfillmentVote=(...args)=>window.__uiState.write('withdraw',...args);`,
  };
  await writeFile(resolve(out, 'index.html'), `<!doctype html><html><body><div id="root"></div><script type="module" src="/@fs/${fixture}/entry.jsx"></script></body></html>`);
  const server = await createServer({
    configFile: false, envDir: out, root: out, cacheDir: resolve(out, 'cache'), publicDir: false,
    plugins: [{ name: 'ui-state-isolated-io', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer) return;
        const actual = source.startsWith('.') ? resolve(dirname(importer.split('?')[0]), source) : source;
        for (const name of Object.keys(modules)) {
          const target = resolve(web, 'src', name);
          if ([target, target + '.ts', target + '.tsx'].includes(actual)) return '\0ui-state:' + name;
        }
      },
      load(id) { if (id.startsWith('\0ui-state:')) return modules[id.slice(10)]; },
    }, react()],
    resolve: { alias: Object.fromEntries(['react', 'react-dom', 'react-router-dom'].map(name => [name, resolve(web, 'node_modules', name)])) },
    css: { postcss: { plugins: [] } },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom'] },
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [out, fixture, resolve(web, 'src'), resolve(web, 'node_modules')] } },
  });
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    await rm(out, { recursive: true, force: true });
    throw error;
  }
  return {
    origin: `http://127.0.0.1:${server.httpServer.address().port}`,
    async close() { await server.close(); await rm(out, { recursive: true, force: true }); },
  };
}

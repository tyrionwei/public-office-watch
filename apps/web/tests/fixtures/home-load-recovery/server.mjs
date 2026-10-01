import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

export async function startHomeLoadFixture() {
  const fixture = dirname(fileURLToPath(import.meta.url));
  const web = resolve(fixture, '../../..');
  const out = await mkdtemp(resolve(tmpdir(), 'pow-home-load-'));
  const modules = {
    i18n: `export const useI18n=()=>({language:'zh-TW',t:(key,values)=>({
      'office.loading':'載入中','app.retry':'重試','home.loadError':'首頁資料載入失敗',
      'home.candidateLoadError':'候選人資料載入失敗','seatDistribution.nationalTitle':'立法委員政黨概況',
      'seatDistribution.localTitle':'地方議員政黨概況','seatDistribution.totalSeats':'席次合計 '+(values?.count??0),
      'seatDistribution.partySeats':(values?.party??'')+' '+(values?.count??0)+'席',
      'national.taiwan':'全國','home.unspecifiedRegion':'未指定地區'
    }[key]??key)});`,
    'lib/publicData': `export const publicDataProvider={
      getHomePageData:()=>({ticker:{title:'',date:'',electionId:null},regions:[],stageRegions:[],stageRegionSummaries:[],upcomingRaces:[],candidateSummaries:[],seatDistribution:[],dataPrinciples:[]}),
      loadHomePageData:regionId=>window.__homeRecovery.load(regionId)
    };`,
    selectedRegion: `import {useState} from 'react';export const useSelectedRegion=()=>{const [selectedRegionId,setSelectedRegionId]=useState(null);return {selectedRegionId,setSelectedRegionId}};`,
    votingRegion: `export const useVotingRegion=()=>({preference:null});`,
    'components/AppShell': `import React from 'react';export const AppShell=({children})=>React.createElement('main',null,children);`,
    'components/HomeElectionSpotlight': `import React from 'react';export const HomeElectionSpotlight=({races})=>React.createElement('section',{'data-races':''},...races.map(r=>React.createElement('p',{key:r.id},r.title)));`,
    'components/MobileMyElection': `export const MobileMyElection=()=>null;`,
    'components/MobileRegionBrowser': `export const MobileRegionBrowser=()=>null;`,
    'components/RegionIssueConcernPanel': `export const RegionIssueConcernPanel=()=>null;`,
    'components/TaiwanStageSelect': `import React from 'react';export const TaiwanStageSelect=({onSelectRegion})=>React.createElement('div',null,React.createElement('button',{onClick:()=>onSelectRegion('taipei')},'Alpha'),React.createElement('button',{onClick:()=>onSelectRegion('new-taipei-city')},'Beta'));`,
    'lib/personData': `export const normalizePartyLabel=value=>value;export const toPartyThemeKey=()=> 'other';`,
  };
  await writeFile(resolve(out, 'index.html'), `<!doctype html><html><body><div id="root"></div><script type="module" src="/@fs/${fixture}/entry.jsx"></script></body></html>`);
  const server = await createServer({
    configFile: false, envDir: out, root: out, cacheDir: resolve(out, 'cache'), publicDir: false,
    plugins: [{ name: 'home-load-isolated-modules', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer) return;
        const actual = source.startsWith('.') ? resolve(dirname(importer.split('?')[0]), source) : source;
        for (const name of Object.keys(modules)) {
          const target = resolve(web, 'src', name);
          if ([target, target + '.ts', target + '.tsx'].includes(actual)) return '\0home-load:' + name;
        }
      },
      load(id) { if (id.startsWith('\0home-load:')) return modules[id.slice(11)]; },
    }, react()],
    resolve: { alias: Object.fromEntries(['react', 'react-dom', 'react-router-dom'].map(name => [name, resolve(web, 'node_modules', name)])) },
    css: { postcss: { plugins: [] } },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom'] },
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [out, fixture, resolve(web, 'src'), resolve(web, 'node_modules')] } },
  });
  try { await server.listen(); }
  catch (error) { await server.close(); await rm(out, { recursive: true, force: true }); throw error; }
  return { origin: `http://127.0.0.1:${server.httpServer.address().port}`, async close() { await server.close(); await rm(out, { recursive: true, force: true }); } };
}

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { buildElectionEvents, getElectionEventByKey } from '../data/electionEvents';
import { translateElectionEventTitle } from '../data/electionI18n';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { publicDataReadyEvent } from '../lib/publicDataProviderFactory';

const siteName = '公職資料觀測站';
const englishSiteName = 'Public Office Watch';
const fallbackSiteUrl = 'https://pow4vote.org';

type RouteMetadataValue = {
  title: string;
  description: string;
  type?: 'website' | 'profile';
  noIndex?: boolean;
  unresolved?: boolean;
  structuredData?: Record<string, unknown>;
};

function safeDecode(value: string | undefined) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function detailDescription(language: 'zh-TW' | 'en', subject: string, kind: 'person' | 'party' | 'region' | 'race' | 'event' | 'election') {
  if (language === 'en') {
    const descriptions = {
      person: `Public offices, party affiliations, candidacies, campaign platforms, and cited public records for ${subject}.`,
      party: `Current officeholders, candidates, political donations, and public-data statistics for ${subject}.`,
      region: `Public officials, elections, candidates, and local public issues for ${subject}.`,
      race: `Candidates, parties, results, and campaign-platform comparison for ${subject}.`,
      event: `Districts, candidates, party performance, and public election data for ${subject}.`,
      election: `Candidates, districts, results, and cited public records for ${subject}.`,
    };
    return descriptions[kind];
  }

  const descriptions = {
    person: `${subject}的公職、黨籍、參選、政見與公開資料來源。`,
    party: `${subject}的現任人員、候選人、政治獻金與公開資料統計。`,
    region: `${subject}公職人員、選舉、候選人與地方議題資料。`,
    race: `${subject}候選人、政黨、得票結果與政見比較。`,
    event: `${subject}的選區、候選人、政黨表現與公開選舉資料。`,
    election: `${subject}的候選人、選區、得票結果與公開資料來源。`,
  };
  return descriptions[kind];
}

function routeMetadata(pathname: string, language: 'zh-TW' | 'en', t: ReturnType<typeof useI18n>['t']): RouteMetadataValue {
  const segments = pathname.split('/').filter(Boolean);
  const isEnglish = language === 'en';

  if (segments[0] === 'internal') {
    return {
      title: isEnglish ? 'Internal administration' : '內部管理',
      description: isEnglish ? 'Private administration page.' : '本站內部管理頁面。',
      noIndex: true,
    };
  }

  if (segments[0] === 'people' && segments[1]) {
    const person = publicDataProvider.getPersonById(safeDecode(segments[1]));
    const name = person?.name ?? (isEnglish ? 'Person profile' : '人物資料');
    return {
      title: name,
      description: detailDescription(language, name, 'person'),
      type: 'profile',
      unresolved: !person,
      structuredData: person ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: person.name,
        jobTitle: person.current_office_label ?? person.position ?? undefined,
        affiliation: person.party ? { '@type': 'Organization', name: person.party } : undefined,
      } : undefined,
    };
  }

  if (segments[0] === 'parties' && segments[1]) {
    const party = publicDataProvider.getPartyBySlug(safeDecode(segments[1]));
    const name = party?.name ?? (isEnglish ? 'Party profile' : '政黨資料');
    return {
      title: name,
      description: detailDescription(language, name, 'party'),
      unresolved: !party,
      structuredData: party ? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: party.name,
      } : undefined,
    };
  }

  if (segments[0] === 'regions' && segments[1]) {
    const summary = publicDataProvider.getRegionSummary(safeDecode(segments[1]));
    const name = summary?.label ?? (isEnglish ? 'Regional public data' : '區域資料');
    return {
      title: name,
      description: detailDescription(language, name, 'region'),
      unresolved: !summary,
    };
  }

  if (segments[0] === 'elections' && segments[1] === 'races' && segments[2]) {
    const race = publicDataProvider.getRaceById(safeDecode(segments[2]));
    const name = race?.title ?? (isEnglish ? 'Election district' : '選區資料');
    return {
      title: name,
      description: detailDescription(language, name, 'race'),
      unresolved: !race,
    };
  }

  if (segments[0] === 'elections' && segments[1] === 'events' && segments[2]) {
    const events = buildElectionEvents(publicDataProvider.getElections(), publicDataProvider.getRaces());
    const event = getElectionEventByKey(events, safeDecode(segments[2]));
    const name = event ? translateElectionEventTitle(event, t) : (isEnglish ? 'Election event' : '選舉事件');
    return {
      title: name,
      description: detailDescription(language, name, 'event'),
      unresolved: !event,
    };
  }

  if (segments[0] === 'elections' && segments[1]) {
    const election = publicDataProvider.getElectionById(safeDecode(segments[1]));
    const name = election?.name ?? (isEnglish ? 'Election' : '選舉資料');
    return {
      title: name,
      description: detailDescription(language, name, 'election'),
      unresolved: !election,
      structuredData: election ? {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: election.name,
        startDate: election.voting_date ?? undefined,
      } : undefined,
    };
  }

  const staticMetadata: Record<string, RouteMetadataValue> = {
    '/': {
      title: isEnglish ? englishSiteName : siteName,
      description: isEnglish
        ? 'Explore Taiwan public officials, political parties, elections, campaign platforms, political donations, and cited public records.'
        : '查詢臺灣公職人物、政黨、選舉、候選人政見、政治獻金與公開資料來源。',
    },
    '/people': {
      title: isEnglish ? 'People' : '人物',
      description: isEnglish
        ? 'Browse public offices, experience, party affiliations, election history, campaign platforms, and cited records for Taiwan political figures.'
        : '瀏覽臺灣公職人物的經歷、黨籍、參選紀錄、政見與公開資料來源。',
    },
    '/elections': {
      title: isEnglish ? 'Elections' : '選舉',
      description: isEnglish
        ? 'Browse Taiwan elections, districts, candidates, results, and campaign-platform comparisons.'
        : '瀏覽臺灣歷屆選舉、選區、候選人、當選結果與政見比較。',
    },
    '/parties': {
      title: isEnglish ? 'Parties and political donations' : '政黨與政治獻金',
      description: isEnglish
        ? 'Compare political parties, officeholders, candidates, political donations, and public-data statistics.'
        : '比較臺灣政黨、現任人員、候選人、政治獻金與公開資料統計。',
    },
    '/updates': {
      title: isEnglish ? 'Public data update log' : '公開資料更新紀錄',
      description: isEnglish
        ? 'Review data added and corrected by Public Office Watch. This is not political news, and unreviewed automated results are not published directly.'
        : '查看公職資料觀測站新增與修正的資料；這不是政治新聞，也不會直接公開尚未審核的自動蒐集結果。',
    },
    '/data-guidance': {
      title: isEnglish ? 'Data guidance' : '資料說明',
      description: isEnglish
        ? 'Learn how Public Office Watch collects, reviews, cites, and presents public data.'
        : '了解公職資料觀測站如何蒐集、審核、引用與呈現公開資料。',
    },
    '/about': {
      title: isEnglish ? 'About' : '關於本站',
      description: isEnglish
        ? 'About the goals, principles, and open-source development of Public Office Watch.'
        : '認識公職資料觀測站的目標、資料原則與開源開發方式。',
    },
    '/support': {
      title: isEnglish ? 'Support this site' : '支持本站',
      description: isEnglish
        ? 'One-time support for Public Office Watch hosting, public-data maintenance, and continued development.'
        : '自願支持公職資料觀測站的主機、公開資料維護與持續開發成本。',
    },
  };

  return staticMetadata[pathname] ?? {
    title: isEnglish ? 'Page not found' : '找不到頁面',
    description: isEnglish ? 'The requested public page could not be found.' : '找不到指定的公開頁面。',
    noIndex: true,
  };
}

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function ensureCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }
  element.href = url;
}

function setStructuredData(value: Record<string, unknown> | undefined, url: string) {
  const id = 'public-office-watch-structured-data';
  const current = document.getElementById(id);
  if (!value) {
    current?.remove();
    return;
  }

  const script = current instanceof HTMLScriptElement ? current : document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({ ...value, url });
  if (!script.isConnected) document.head.append(script);
}

export function RouteMetadata() {
  const location = useLocation();
  const { language, t } = useI18n();
  const [publicDataVersion, setPublicDataVersion] = useState(0);

  useEffect(() => {
    const handlePublicDataReady = () => setPublicDataVersion((version) => version + 1);
    window.addEventListener(publicDataReadyEvent, handlePublicDataReady);
    return () => window.removeEventListener(publicDataReadyEvent, handlePublicDataReady);
  }, []);

  useEffect(() => {
    const metadata = routeMetadata(location.pathname, language, t);
    const isHome = location.pathname === '/';
    const fullTitle = isHome ? `${siteName}｜${englishSiteName}` : `${metadata.title}｜${siteName}`;
    const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
    const siteUrl = configuredSiteUrl ? new URL(configuredSiteUrl).origin : fallbackSiteUrl;
    const canonicalUrl = new URL(location.pathname, siteUrl).toString();
    const imageUrl = new URL('/og.png', siteUrl).toString();
    const existingCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    const preserveServerMetadata = metadata.unresolved
      && existingCanonical
      && new URL(existingCanonical, window.location.href).pathname === location.pathname;

    document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant';
    if (preserveServerMetadata) return;

    document.title = fullTitle;
    ensureCanonical(canonicalUrl);
    ensureMeta('meta[name="description"]', { name: 'description', content: metadata.description });
    ensureMeta('meta[name="robots"]', {
      name: 'robots',
      content: metadata.noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large',
    });
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: metadata.type ?? 'website' });
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: siteName });
    ensureMeta('meta[property="og:locale"]', { property: 'og:locale', content: language === 'en' ? 'en_US' : 'zh_TW' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: metadata.description });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    ensureMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: `${siteName}｜${englishSiteName}` });
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: metadata.description });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
    setStructuredData(metadata.structuredData, canonicalUrl);
  }, [language, location.pathname, publicDataVersion, t]);

  return null;
}

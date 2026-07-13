/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

export type Language = 'zh-TW' | 'en';

type TranslationValues = Record<string, string | number>;

const storageKey = 'public-office-watch-language';

const translations = {
  'zh-TW': {
    'brand.name': '公職資料觀測站',
    'brand.subtitle': 'Public Office Watch',
    'common.all': '全部',
    'common.search': '搜尋',
    'common.clearFilters': '清除篩選',
    'common.view': '查看',
    'common.toBeAnnounced': '待公告',
    'common.recordsPage': '{count} 筆資料 · 第 {currentPage}/{pageCount} 頁',
    'common.peopleCount': '{count} 位',
    'nav.home': '首頁',
    'nav.people': '人物',
    'nav.elections': '選舉',
    'nav.parties': '政黨與獻金',
    'nav.dataGuidance': '資料說明',
    'nav.about': '關於本站',
    'nav.mainAria': '主導覽',
    'nav.homeAria': '回到首頁',
    'language.aria': '切換語言',
    'language.label': '語言',
    'language.zh': '中文',
    'language.en': 'EN',
    'search.placeholder': '搜尋人物、公司、政黨、選舉、地區',
    'search.minChars': '請輸入至少 2 個字元。',
    'search.noResults': '找不到符合的公開資料。',
    'search.detailDisabled': '詳情頁未啟用',
    'search.type.party': '政黨',
    'search.type.election': '選舉',
    'search.type.region': '地區',
    'search.type.person': '人物',
    'search.type.company': '公司',
    'home.unspecifiedRegion': '未指定區域',
    'stage.quickSelect': '縣市快速選擇',
    'stage.backupList': '備用清單',
    'stage.countyGuide': '台灣縣市導覽',
    'stage.countyLevel': '縣市層級',
    'stage.countyCode': '縣市代碼 {code}',
    'regionHud.title': '縣市重點',
    'regionHud.currentCounty': '目前選取縣市',
    'regionHud.defaultTone': '公開資料導覽區塊',
    'regionHud.nearestElection': '最近選舉',
    'regionHud.voteDate': '投票日',
    'regionHud.publicItems': '公開項目',
    'regionHud.upcomingRaceCount': '{count} 項待追蹤選舉',
    'regionHud.chiefElection': '首長選舉',
    'regionHud.representativeElection': '民意代表選舉',
    'regionHud.basicOffice': '基層公職',
    'regionHud.viewCounty': '查看此縣市',
    'electionCards.titleCompact': '即將到來的選舉',
    'electionCards.titleFull': '熱門選舉項目',
    'electionCards.selectedRegion': '目前選取區域：{region}',
    'electionCards.noRelated': '目前沒有找到和 {region} 直接相關的即將到來選舉。',
    'electionCards.item': '選舉項目 {number}',
    'electionCards.voteDate': '投票日',
    'electionCards.status': '狀態',
    'electionCards.regionRelation': '區域關聯',
    'electionCards.relatedRegion': '目前選取區域相關',
    'electionCards.demoCard': '示範卡片',
    'electionCards.viewElection': '查看選舉資訊',
    'electionCards.viewElectionItem': '查看選舉項目',
    'electionCards.viewRaceAria': '查看{title}',
    'electionCards.status.upcoming': '即將進行',
    'electionCards.status.announced': '已公告',
    'electionCards.status.active': '進行中',
    'electionCards.status.completed': '已完成',
    'electionCards.group.village.title': '村里長選舉',
    'electionCards.group.village.count': '個村里層級選舉項目',
    'electionCards.group.village.action': '點開選擇行政區',
    'electionCards.group.councilor.title': '議員選舉',
    'electionCards.group.councilor.count': '個議員選區項目',
    'electionCards.group.councilor.action': '點開選擇選區',
    'electionCards.group.legislator.title': '區域立法委員選舉',
    'electionCards.group.legislator.count': '個立委選區項目',
    'electionCards.group.legislator.action': '點開選擇選區',
    'office.title': '縣市公職摘要',
    'office.viewPeople': '查看人物',
    'office.currentLocalOffice': '目前縣市公職',
    'office.councilorTotal': '議員總數',
    'office.dataPending': '資料待補',
    'office.currentOfficeFallback': '現任公職',
    'office.otherTitle': '其他{title}',
    'office.closeList': '關閉{title}清單',
    'office.collapseOthers': '收回其他人員',
    'office.showMorePeople': '顯示另外 {count} 位',
    'office.councilors': '議員',
    'office.deputyChiefs': '副縣市首長',
    'office.agencyHeads': '主要單位首長',
    'office.councilorPartyCards': '議員政黨分布',
    'office.available': '已接入',
    'office.todo': '待同步',
    'office.emptyChief': '尚未找到可公開的現任縣市首長資料。',
    'office.emptyDeputies': '地方政府名冊待同步：副縣市長資料尚未接入。',
    'office.emptyAgencyHeads': '局處首長資料待同步。',
    'office.emptyCouncilors': '尚未找到可公開的現任議員資料；後續會接地方選舉異動與地方政府名冊校正。',
    'people.filterTitle': '人物篩選',
    'people.keyword': '搜尋姓名',
    'people.region': '區域',
    'people.party': '政黨',
    'people.role': '身分',
    'people.status': '狀態',
    'people.title': '人物與候選人',
    'people.currentFilters': '目前篩選',
    'people.allPeople': '全部人物',
    'people.defaultScope': '預設顯示總統、立委、縣市首長與議員等主要層級，暫不列出村里長與鄉鎮市民代表。輸入姓名搜尋時仍會查完整人物資料。',
    'people.currentResults': '目前結果',
    'people.recordsUnit': '筆',
    'people.sortHint': '排序：現任優先 → 職位層級 → 姓名。',
    'people.name': '姓名',
    'people.noRegion': '未指定',
    'people.noResults': '沒有符合目前篩選條件的人物資料。',
    'people.showing': '顯示 {start}-{end} / {total}',
    'people.first': '頭',
    'people.previous': '上一頁',
    'people.next': '下一頁',
    'people.last': '底',
    'people.role.president': '總統',
    'people.role.vice_president': '副總統',
    'people.role.legislator': '立法委員',
    'people.role.local_chief': '縣市首長',
    'people.role.local_deputy': '副縣市首長',
    'people.role.agency_head': '主要單位首長',
    'people.role.councilor': '議員',
    'people.role.party_officer': '政黨職務',
    'people.role.candidate': '候選人',
    'people.role.other': '其他',
    'people.status.current': '現任',
    'people.status.candidate': '候選人',
    'people.status.former': '曾參選',
    'people.status.other': '其他',
  },
  en: {
    'brand.name': 'Public Office Watch',
    'brand.subtitle': 'Taiwan public data navigator',
    'common.all': 'All',
    'common.search': 'Search',
    'common.clearFilters': 'Clear filters',
    'common.view': 'View',
    'common.toBeAnnounced': 'TBA',
    'common.recordsPage': '{count} records · page {currentPage}/{pageCount}',
    'common.peopleCount': '{count} people',
    'nav.home': 'Home',
    'nav.people': 'People',
    'nav.elections': 'Elections',
    'nav.parties': 'Parties & donations',
    'nav.dataGuidance': 'Data notes',
    'nav.about': 'About',
    'nav.mainAria': 'Primary navigation',
    'nav.homeAria': 'Back to home',
    'language.aria': 'Switch language',
    'language.label': 'Language',
    'language.zh': '中文',
    'language.en': 'EN',
    'search.placeholder': 'Search people, companies, parties, elections, regions',
    'search.minChars': 'Enter at least 2 characters.',
    'search.noResults': 'No matching public records found.',
    'search.detailDisabled': 'Detail page unavailable',
    'search.type.party': 'Parties',
    'search.type.election': 'Elections',
    'search.type.region': 'Regions',
    'search.type.person': 'People',
    'search.type.company': 'Companies',
    'home.unspecifiedRegion': 'Unspecified region',
    'stage.quickSelect': 'County quick select',
    'stage.backupList': 'Fallback list',
    'stage.countyGuide': 'Taiwan County Guide',
    'stage.countyLevel': 'County level',
    'stage.countyCode': 'County code {code}',
    'regionHud.title': 'County highlights',
    'regionHud.currentCounty': 'Selected county/city',
    'regionHud.defaultTone': 'Public data guide panel',
    'regionHud.nearestElection': 'Nearest election',
    'regionHud.voteDate': 'Election day',
    'regionHud.publicItems': 'Public items',
    'regionHud.upcomingRaceCount': '{count} races to track',
    'regionHud.chiefElection': 'Executive elections',
    'regionHud.representativeElection': 'Representative elections',
    'regionHud.basicOffice': 'Grassroots offices',
    'regionHud.viewCounty': 'View this county',
    'electionCards.titleCompact': 'Upcoming elections',
    'electionCards.titleFull': 'Featured election items',
    'electionCards.selectedRegion': 'Selected region: {region}',
    'electionCards.noRelated': 'No upcoming elections directly related to {region} were found.',
    'electionCards.item': 'Election item {number}',
    'electionCards.voteDate': 'Election day',
    'electionCards.status': 'Status',
    'electionCards.regionRelation': 'Region link',
    'electionCards.relatedRegion': 'Related to selected region',
    'electionCards.demoCard': 'Demo card',
    'electionCards.viewElection': 'View election info',
    'electionCards.viewElectionItem': 'View election item',
    'electionCards.viewRaceAria': 'View {title}',
    'electionCards.status.upcoming': 'Upcoming',
    'electionCards.status.announced': 'Announced',
    'electionCards.status.active': 'Active',
    'electionCards.status.completed': 'Completed',
    'electionCards.group.village.title': 'Village chief elections',
    'electionCards.group.village.count': 'village-level election items',
    'electionCards.group.village.action': 'Open to choose area',
    'electionCards.group.councilor.title': 'Councilor elections',
    'electionCards.group.councilor.count': 'councilor district items',
    'electionCards.group.councilor.action': 'Open to choose district',
    'electionCards.group.legislator.title': 'District legislator elections',
    'electionCards.group.legislator.count': 'legislator district items',
    'electionCards.group.legislator.action': 'Open to choose district',
    'office.title': 'Local office summary',
    'office.viewPeople': 'View people',
    'office.currentLocalOffice': 'Current local offices',
    'office.councilorTotal': 'Councilors',
    'office.dataPending': 'Data pending',
    'office.currentOfficeFallback': 'Current office',
    'office.otherTitle': 'Other {title}',
    'office.closeList': 'Close {title} list',
    'office.collapseOthers': 'Collapse other people',
    'office.showMorePeople': 'Show {count} more',
    'office.councilors': 'Councilors',
    'office.deputyChiefs': 'Deputy executives',
    'office.agencyHeads': 'Agency heads',
    'office.councilorPartyCards': 'Councilor party distribution',
    'office.available': 'Available',
    'office.todo': 'Pending',
    'office.emptyChief': 'No public current county/city executive record found yet.',
    'office.emptyDeputies': 'Local government roster pending: deputy executive data is not connected yet.',
    'office.emptyAgencyHeads': 'Agency head data is pending sync.',
    'office.emptyCouncilors': 'No public current councilor records found yet; local election changes and government rosters will be reconciled later.',
    'people.filterTitle': 'People filters',
    'people.keyword': 'Search name',
    'people.region': 'Region',
    'people.party': 'Party',
    'people.role': 'Role',
    'people.status': 'Status',
    'people.title': 'People and candidates',
    'people.currentFilters': 'Current filters',
    'people.allPeople': 'All people',
    'people.defaultScope': 'By default, this view shows major levels such as presidents, legislators, local executives, and councilors. Village chiefs and township representatives are not listed here yet. Name search still checks the full people dataset.',
    'people.currentResults': 'Current results',
    'people.recordsUnit': 'records',
    'people.sortHint': 'Sort: current office first -> office level -> name.',
    'people.name': 'Name',
    'people.noRegion': 'Unspecified',
    'people.noResults': 'No people match the current filters.',
    'people.showing': 'Showing {start}-{end} / {total}',
    'people.first': 'First',
    'people.previous': 'Previous',
    'people.next': 'Next',
    'people.last': 'Last',
    'people.role.president': 'President',
    'people.role.vice_president': 'Vice president',
    'people.role.legislator': 'Legislator',
    'people.role.local_chief': 'Local executive',
    'people.role.local_deputy': 'Deputy local executive',
    'people.role.agency_head': 'Agency head',
    'people.role.councilor': 'Councilor',
    'people.role.party_officer': 'Party officer',
    'people.role.candidate': 'Candidate',
    'people.role.other': 'Other',
    'people.status.current': 'Current',
    'people.status.candidate': 'Candidate',
    'people.status.former': 'Former candidate',
    'people.status.other': 'Other',
  },
} as const;

export type TranslationKey = keyof typeof translations['zh-TW'];
export type Translate = (key: TranslationKey, values?: TranslationValues) => string;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'zh-TW';

  const stored = window.localStorage.getItem(storageKey);
  if (stored === 'zh-TW' || stored === 'en') return stored;

  return window.navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh-TW';
}

function formatTranslation(template: string, values?: TranslationValues) {
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(storageKey, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const t: Translate = (key, values) => formatTranslation(translations[language][key] ?? translations['zh-TW'][key], values);

    return {
      language,
      setLanguage: setLanguageState,
      t,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useI18n must be used within LanguageProvider');
  }

  return context;
}

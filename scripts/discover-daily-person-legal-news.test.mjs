import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPersonLegalFeedUrl,
  buildPersonLegalLeads,
  buildPersonResearchFeedUrl,
  buildPersonResearchLeads,
  directLegalSubjectMatch,
} from './discover-daily-person-legal-news.mjs';

const feed = {
  baseUrl: 'https://news.google.com/rss/search',
  language: 'zh-TW',
  country: 'TW',
  edition: 'TW:zh-Hant',
};

test('builds a per-person legal query without a current-news time limit', () => {
  const url = new URL(buildPersonLegalFeedUrl(feed, { name: '陳水扁' }, ['貪污', '起訴']));

  assert.match(url.searchParams.get('q'), /"陳水扁"/);
  assert.match(url.searchParams.get('q'), /貪污 OR 起訴/);
  assert.doesNotMatch(url.searchParams.get('q'), /when:/);
});

test('adds a 30-day limit only for recurring person research', () => {
  const historical = new URL(buildPersonResearchFeedUrl(feed, { name: '測試人物' }, ['配偶']));
  const recurring = new URL(buildPersonResearchFeedUrl(feed, { name: '測試人物' }, ['配偶'], 30));
  const delayed = new URL(buildPersonResearchFeedUrl(feed, { name: '測試人物' }, ['配偶'], 72));

  assert.doesNotMatch(historical.searchParams.get('q'), /when:/);
  assert.match(recurring.searchParams.get('q'), /when:30d/);
  assert.match(delayed.searchParams.get('q'), /when:72d/);
});

test('keeps family research leads private and tagged with their time scope', () => {
  const leads = buildPersonResearchLeads({
    target: {
      personId: 'person-family',
      name: '王小明',
      position: '立法委員',
      district: '測試選區',
    },
    items: [{
      title: '立委王小明妻子出席公益活動',
      summary: '',
      url: 'https://example.com/family',
      publishedAt: '2020-01-01T00:00:00Z',
      publisherName: '中央社',
      publisherUrl: 'https://www.cna.com.tw/',
    }],
    category: 'family_relation',
    categoryLabel: '家族關係',
    terms: ['妻子'],
    nextAction: 'confirm relationship',
    trustedPublishers: ['中央社'],
    timeScope: 'historical_backfill',
  });

  assert.equal(leads.length, 1);
  assert.equal(leads[0].category, 'family_relation');
  assert.equal(leads[0].timeScope, 'historical_backfill');
  assert.equal(leads[0].visibility, 'review_only');
  assert.equal(leads[0].autoPublish, false);
});

test('keeps historical legal clues private with identity context and year hints', () => {
  const leads = buildPersonLegalLeads({
    target: {
      personId: 'person-1',
      name: '陳水扁',
      party: '',
      position: '中華民國總統',
      district: '全國',
      experience: '2000年總統當選',
    },
    items: [{
      title: '前總統陳水扁涉貪污案 2008年遭起訴',
      summary: '案件後續由法院審理。',
      url: 'https://example.com/legal-news',
      publishedAt: '2024-01-01T00:00:00Z',
      publisherName: '中央社',
      publisherUrl: 'https://www.cna.com.tw/',
    }],
    legalTerms: ['貪污', '起訴'],
    trustedPublishers: ['中央社'],
  });

  assert.equal(leads.length, 1);
  assert.equal(leads[0].identityStatus, 'context_supported');
  assert.deepEqual(leads[0].matchedContextTerms, ['總統']);
  assert.deepEqual(leads[0].mentionedYears, [2008]);
  assert.equal(leads[0].sourceQuality, 'B');
  assert.equal(leads[0].reviewStatus, 'pending');
  assert.equal(leads[0].reviewRoute, 'codex_identity_review');
  assert.equal(leads[0].manualReviewRequired, false);
  assert.equal(leads[0].visibility, 'review_only');
  assert.equal(leads[0].autoPublish, false);
});

test('retains name-only legal clues for downstream identity review', () => {
  const leads = buildPersonLegalLeads({
    target: {
      personId: 'person-2',
      name: '王小明',
      party: '',
      position: '里長',
      district: '測試里',
      experience: '',
    },
    items: [{
      title: '王小明涉詐欺遭起訴',
      summary: '',
      url: 'https://example.com/name-only',
      publishedAt: '2025-01-01T00:00:00Z',
      publisherName: '未知來源',
      publisherUrl: '',
    }],
    legalTerms: ['詐欺', '起訴'],
    trustedPublishers: [],
  });

  assert.equal(leads.length, 1);
  assert.equal(leads[0].identityStatus, 'name_only_requires_review');
  assert.equal(leads[0].sourceQuality, 'C');
});

test('drops articles without both the target name and a legal term', () => {
  const leads = buildPersonLegalLeads({
    target: { personId: 'person-3', name: '王小明', position: '里長' },
    items: [
      { title: '王小明出席活動', summary: '', url: 'https://example.com/no-legal' },
      { title: '李小明涉詐欺', summary: '', url: 'https://example.com/no-name' },
    ],
    legalTerms: ['詐欺'],
    trustedPublishers: [],
  });

  assert.equal(leads.length, 0);
});

test('rejects legal terms that describe somebody else in the headline', () => {
  assert.equal(directLegalSubjectMatch('陳水扁透露李登輝曾被約談', '陳水扁', ['約談']), false);
  assert.equal(directLegalSubjectMatch('前總統陳水扁涉貪污遭起訴', '陳水扁', ['貪污', '起訴']), true);
});

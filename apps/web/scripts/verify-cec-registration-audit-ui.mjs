import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

async function read(path) {
  const response = await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert(response?.ok(), path + ' returned ' + response?.status());
  await page.locator('main').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(350);
  return page.locator('body').innerText();
}

const profiles = [
  { id: '320c38ea-48a7-4cfb-a77b-5842abcda5ac', name: '謝龍介' },
  { id: '2ec71727-7227-4ee6-a5dc-b16493f0ad27', name: '徐尚裕' },
  { id: 'c1a80678-c645-4bfb-8d93-73423c5f7aaa', name: '布落‧馬信' },
  { id: '147c1321-53d1-4dd3-89de-7823697c7098', name: '蘇錦雄Paylang ‧Caya' },
];
const checked = [];
for (const profile of profiles) {
  const text = await read('/people/' + profile.id);
  assert(text.includes(profile.name), profile.name + ' profile name missing');
  assert(text.includes('已申請登記'), profile.name + ' registration status missing: ' + text.slice(0, 1800));
  assert(!text.includes('</span>') && !text.includes('style='), profile.name + ' profile contains HTML debris');
  checked.push({ ...profile, registrationVisible: true });
}

const races = [
  {
    id: '9599a0fa-812a-4170-9bde-01a2090f78af',
    absent: ['翁壽良'],
    present: ['張啓楷', '王美惠', '王義成', '陳愷璜', '黃宏成台灣阿成世界偉人財神總統'],
  },
  {
    id: 'd5ff7084-7ff1-41c6-9e83-741e78b6b699',
    absent: ['陳政慈'],
    present: ['吳朝成', '呂佳怡', '呂念澤', '呂榮發', '姜文博', '張一民', '張明慧', '林秀怡', '羅世泉'],
  },
  {
    id: 'acc7ba63-6e8f-461a-b55c-db6c02596537',
    absent: ['蔡筱薇', '陳金鐘'],
    present: [],
  },
];
for (const race of races) {
  const text = await read('/elections/races/' + race.id);
  for (const name of race.absent) assert(!text.includes(name), name + ' should not remain in the active race roster');
  for (const name of race.present) assert(text.includes(name), name + ' official registration is missing');
  checked.push({ raceId: race.id, absent: race.absent, presentCount: race.present.length });
}

const homeResponse = await page.goto(origin + '/?region=hualien-county', { waitUntil: 'domcontentloaded', timeout: 30000 });
assert(homeResponse?.ok(), 'Hualien home returned ' + homeResponse?.status());
await page.locator('[data-candidate-category-tabs]').waitFor({ state: 'visible', timeout: 10000 });
await page.getByRole('button', { name: /^縣議員/ }).click();
const registrationName = page.locator('[data-registration-name]').first();
await registrationName.waitFor({ state: 'visible', timeout: 10000 });
const registrationSprite = registrationName.locator('[data-candidate-sprite]');
assert.equal(await registrationSprite.getAttribute('src'), '/assets/characters/xiezhi/xiezhi-idle.png');
assert.equal(await registrationName.evaluate((element) => element.closest('a')), null);
await registrationName.locator('xpath=..').screenshot({ path: 'tmp/home-name-only-candidate-card.png' });

const villageDirectory = page.locator('[data-village-candidate-directory]');
await villageDirectory.waitFor({ state: 'visible', timeout: 10000 });
const villageDirectoryText = await villageDirectory.innerText();
assert(villageDirectoryText.includes('首頁不任意抽樣顯示'));
const villageDirectoryLink = villageDirectory.getByRole('link');
const villageDirectoryHref = await villageDirectoryLink.getAttribute('href');
assert(villageDirectoryHref?.includes('category=village_chief'));
await villageDirectory.screenshot({ path: 'tmp/home-village-candidate-directory.png' });
await villageDirectoryLink.click();
await page.waitForURL(/category=village_chief/, { timeout: 10000 });
await page.locator('main').waitFor({ state: 'visible', timeout: 10000 });
checked.push({
  homeRegion: '花蓮縣',
  nameOnlyCandidateUsesMascot: true,
  nameOnlyCandidateHasProfileLink: false,
  villageChiefHomepageSampling: false,
  villageChiefDirectoryHref: villageDirectoryHref,
});

await page.evaluate(() => {
  window.localStorage.setItem('public-office-watch.voting-region-preference.v1', JSON.stringify({
    county: { id: 'hualien-county', name: '花蓮縣' },
    source: 'manual',
    confirmedAt: '2026-09-05T00:00:00+08:00',
  }));
});
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const mobileRoster = page.locator('[data-mobile-candidate-roster]');
await mobileRoster.waitFor({ state: 'visible', timeout: 10000 });
const mobileRegistrationName = mobileRoster.locator('[data-registration-name]').first();
await mobileRegistrationName.waitFor({ state: 'visible', timeout: 10000 });
assert.equal(
  await mobileRegistrationName.locator('[data-candidate-sprite]').getAttribute('src'),
  '/assets/characters/xiezhi/xiezhi-idle.png',
);
assert.equal(await mobileRegistrationName.evaluate((element) => element.closest('a')), null);
const mobileRosterText = await mobileRoster.innerText();
assert(!/村長選舉|里長選舉/.test(mobileRosterText));
assert((await page.locator('[data-mobile-village-candidate-policy]').innerText()).includes('首頁不任意抽樣顯示'));
checked.push({
  mobileHome: true,
  nameOnlyCandidateUsesMascot: true,
  nameOnlyCandidateHasProfileLink: false,
  villageChiefHomepageSampling: false,
});

assert.deepEqual(errors, []);
await browser.close();
console.log(JSON.stringify({ origin, checked, consoleErrors: errors.length }, null, 2));

export const currentCountyNames = [
  '臺北市',
  '新北市',
  '桃園市',
  '臺中市',
  '臺南市',
  '高雄市',
  '基隆市',
  '新竹市',
  '嘉義市',
  '宜蘭縣',
  '新竹縣',
  '苗栗縣',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義縣',
  '屏東縣',
  '臺東縣',
  '花蓮縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
] as const;

const historicalCountyNames = new Map([
  ['臺北縣', '新北市'],
  ['桃園縣', '桃園市'],
  ['臺中縣', '臺中市'],
  ['臺南縣', '臺南市'],
  ['高雄縣', '高雄市'],
]);

const countyOrder = new Map(currentCountyNames.map((name, index) => [name, index]));

export function normalizeTaiwanText(value: string) {
  return value.replace(/台/g, '臺');
}

export function toCurrentCountyName(value: string) {
  const normalized = normalizeTaiwanText(value);
  return historicalCountyNames.get(normalized) ?? normalized;
}

export function isCurrentCountyName(value: string) {
  return countyOrder.has(toCurrentCountyName(value) as (typeof currentCountyNames)[number]);
}


import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';

const dataPrinciples = [
  '只呈現公開且可追溯的資料。',
  '人工審核與來源紀錄優先於視覺效果。',
  '行政區導覽不等於正式選舉選區。',
  '前端僅讀 public views，不讀未審核資料。',
  '介面可帶 arcade 語言，但資料表達保持中性。',
];

const confidenceLevels = [
  ['A', '官方登記、公告或原始文件可直接確認。'],
  ['B', '公開資料可交叉比對，且已人工審核。'],
  ['C', '公司登記、政治獻金、標案等資料提供輔助佐證。'],
  ['D', '資訊不足或仍需補查，不應作為結論使用。'],
];

export function DataGuidancePage() {
  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title="Data Guidance">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">principles / confidence / contribution boundary</p>
            <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">資料說明</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              這裡集中放置資料原則、可信度分級與政治獻金限制。頁面可有像素風格，但資料敘述保持中性、保守、可追溯。
            </p>
          </div>
        </PixelFrame>

        <SectionPanel title="資料原則" eyebrow="data principles">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {dataPrinciples.map((principle) => (
              <p key={principle} className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                {principle}
              </p>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="可信度分級" eyebrow="confidence levels">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {confidenceLevels.map(([level, description]) => (
              <article key={level} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                <p className="font-display text-3xl text-signal">{level}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="政治獻金限制" eyebrow="political contribution policy">
          <div className="grid gap-3 text-sm leading-6 text-slate-300 lg:grid-cols-3">
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4">
              第一版只顯示政黨層級摘要，不公開個人捐贈明細，避免過早暴露高風險資料。
            </p>
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4">
              公司關係摘要需同時有來源、年度、金額摘要與人工審核紀錄，不能從未審核資料直接公開。
            </p>
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4">
              官方資料來源優先；民間整理站可作呈現參考，正式接入前需確認授權與欄位處理方式。
            </p>
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}

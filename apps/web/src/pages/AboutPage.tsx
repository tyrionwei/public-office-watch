import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';

export function AboutPage() {
  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title="About">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">public office watch</p>
            <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">關於本站</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              公職資料觀測站是一個整理台灣公職、候選人、選舉、政黨與可驗證公開資料關係的實驗型資料介面。
              目前重點是建立可追溯、可審核、可逐步接入真實資料的 public view 流程。
            </p>
          </div>
        </PixelFrame>

        <SectionPanel title="目前進度" eyebrow="current focus">
          <div className="grid gap-3 md:grid-cols-3">
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
              地圖與區域導覽已建立像素風首頁體驗，縣市邊界資料以示意圖方式呈現。
            </p>
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
              選舉、候選人、政黨與政治獻金資料先以 mock public views 驗證資料形狀。
            </p>
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
              未審核資料、原始 dump、service key 與內部資料表不進入前端公開介面。
            </p>
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}

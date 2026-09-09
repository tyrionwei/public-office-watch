import { useCallback, useEffect, useRef, useState } from 'react';
import { SectionPanel } from './SectionPanel';
import { loadAdminDisplaySettings, PublicUpdateAdminApiError, setAdminBirthDateDisplay } from '../lib/publicUpdateAdmin';
import { publicDisplaySettingsChangedEvent } from '../lib/publicDisplaySettings';
import type { PublicDisplaySettings } from '../lib/publicBirthDate';

export function BirthDateDisplayAdmin() {
  const [settings, setSettings] = useState<PublicDisplaySettings | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await loadAdminDisplaySettings();
      if (current === generation.current) setSettings(next);
    } catch {
      if (current === generation.current) {
        setSettings(null);
        setError('無法讀取生日顯示設定，請重新整理後再試。');
      }
    } finally { if (current === generation.current) setBusy(false); }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  async function change(yearOnly: boolean) {
    if (!settings || busy) return;
    const current = ++generation.current;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await setAdminBirthDateDisplay(yearOnly, settings.revision);
      if (current !== generation.current) return;
      setSettings(next);
      setSaved(true);
      window.dispatchEvent(new Event(publicDisplaySettingsChangedEvent));
    } catch (caught) {
      if (current !== generation.current) return;
      setSettings(null);
      setError(caught instanceof PublicUpdateAdminApiError && caught.code === 'PUBLIC_UPDATE_ADMIN_DISPLAY_CONFLICT'
        ? '設定已由其他管理員更新，請重新整理後再選擇。'
        : '未能確認儲存結果，請重新整理確認目前設定。');
    } finally { if (current === generation.current) setBusy(false); }
  }

  return (
    <SectionPanel title="生日公開顯示" eyebrow="全站設定">
      <p id="birth-date-display-description" className="text-sm leading-6 text-slate-400">
        預設顯示完整生日，方便辨識同名人物。開啟後，所有公開人物頁只顯示出生年份；完整日期仍保留供管理員比對。
      </p>
      {settings ? (
        <label className="mt-4 flex items-center gap-3 text-sm text-white">
          <input type="checkbox" role="switch" checked={settings.birth_date_year_only} disabled={busy}
            aria-describedby="birth-date-display-description"
            onChange={event => void change(event.target.checked)}
            className="h-5 w-5 accent-cyan-300 disabled:opacity-50" />
          僅顯示出生年份
        </label>
      ) : null}
      {busy ? <p role="status" className="mt-3 text-sm text-slate-400">{settings ? '儲存中…' : '正在讀取設定…'}</p> : null}
      {saved ? <p role="status" className="mt-3 text-sm text-accent">已儲存。新開啟或重新整理的人物頁會使用此設定；正在瀏覽的人物頁會在一分鐘內更新。</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void refresh()}
        className="mt-4 border border-line px-3 py-2 text-sm text-slate-300 hover:text-white disabled:opacity-50">
        重新整理生日設定
      </button>
    </SectionPanel>
  );
}

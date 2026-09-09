import { useEffect, useState } from 'react';
import { loadPublicDisplaySettings, publicDisplaySettingsChangedEvent } from './publicDisplaySettings';

export function useBirthDateDisplay() {
  // Do not flash full dates before the shared setting is known, or after its
  // read fails. The persisted default is full date, not a browser preference.
  const [yearOnly, setYearOnly] = useState(true);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      void loadPublicDisplaySettings().then(settings => {
        if (active && current === generation) setYearOnly(settings.birth_date_year_only);
      }).catch(() => {
        if (active && current === generation) setYearOnly(true);
      });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    const interval = window.setInterval(onVisible, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener(publicDisplaySettingsChangedEvent, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(publicDisplaySettingsChangedEvent, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return yearOnly;
}

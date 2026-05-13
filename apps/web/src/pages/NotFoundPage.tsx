import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { homePath } from '../routes/routePaths';

export function NotFoundPage() {
  return (
    <AppShell>
      <PixelFrame title="Not Found">
        <div className="space-y-3 text-sm text-slate-300">
          <h2 className="font-display text-3xl text-white">找不到對應頁面</h2>
          <p>這個路由目前沒有對應的公開資料頁面，或尚未接入正式資料。</p>
          <Link
            to={homePath()}
            className="inline-flex rounded-sm border border-accent/60 bg-accent/10 px-4 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent"
          >
            返回首頁
          </Link>
        </div>
      </PixelFrame>
    </AppShell>
  );
}

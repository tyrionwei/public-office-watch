import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export type ElectionBreadcrumbItem = {
  label: string;
  to?: string;
};

export function ElectionBreadcrumbs({ items }: { items: ElectionBreadcrumbItem[] }) {
  const { t } = useI18n();

  return (
    <nav data-election-breadcrumb aria-label={t('breadcrumb.aria')} className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2 text-xs text-slate-400">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span className="text-slate-600" aria-hidden="true">›</span> : null}
              {item.to && !isCurrent ? (
                <Link to={item.to} className="transition hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/35">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined} className={isCurrent ? 'text-white' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

import { Link } from 'react-router-dom';
import { getCandidateSpriteCreditId } from '../data/candidateSpriteCreditId';
import { useI18n } from '../i18n';
import { aboutPath } from '../routes/routePaths';

export function CandidateSpriteCreditLink({ personId, hint = false }: { personId?: string | null; hint?: boolean }) {
  const { t } = useI18n();
  const credit = getCandidateSpriteCreditId(personId);
  if (!credit) return null;
  if (hint) return <p data-sprite-credit-hint className="mt-1 text-[10px] leading-4 text-slate-400">{t('spriteCredit.personHint')}</p>;
  return (
    <Link data-sprite-credit-link to={`${aboutPath()}?imageCredit=${credit}`}
      className="inline-block text-[11px] leading-5 text-accent underline underline-offset-2 hover:text-white">
      {t('spriteCredit.link')}
    </Link>
  );
}

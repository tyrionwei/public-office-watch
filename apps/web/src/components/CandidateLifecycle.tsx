import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { CandidateLifecycleEvent } from '../types/candidateLifecycle';

const eventLabels: Record<CandidateLifecycleEvent['event_type'], [string, string]> = {
  party_nomination_announced: ['政黨提名公告', 'Party nomination announced'],
  candidacy_announced: ['宣布參選', 'Candidacy announced'],
  registration_filed: ['申請登記', 'Registration filed'],
  qualification_confirmed: ['資格審定通過', 'Qualification confirmed'],
  qualification_rejected: ['資格審定未通過', 'Qualification rejected'],
  withdrawn: ['撤回參選', 'Candidacy withdrawn'],
  ballot_number_assigned: ['抽籤號次', 'Ballot number assigned'],
  official_candidate_list_published: ['正式候選人名單公告', 'Official candidate list published'],
  election_result_published: ['選舉結果公告', 'Election result published'],
};

export function CandidateLifecycle({ candidateId, registered }: { candidateId: string; registered: boolean }) {
  const { language } = useI18n();
  const english = language === 'en';
  const [state, setState] = useState<{ candidateId: string; events: CandidateLifecycleEvent[]; error: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    publicDataProvider.loadCandidateLifecycle(candidateId)
      .then((events) => { if (active) setState({ candidateId, events, error: false }); })
      .catch(() => { if (active) setState({ candidateId, events: [], error: true }); });
    return () => { active = false; };
  }, [candidateId]);
  const current = state?.candidateId === candidateId ? state : null;
  return (
    <div data-candidate-lifecycle className="mt-3 border-t border-line/60 pt-3">
      {registered ? <p className="text-xs leading-5 text-amber-200">{english ? 'Awaiting qualification review by the election commission.' : '尚待選舉委員會資格審定。'}</p> : null}
      <h4 className="mt-2 text-xs text-slate-400">{english ? 'Candidacy timeline' : '參選時間線'}</h4>
      {!current ? <p role="status" className="mt-2 text-xs text-slate-500">{english ? 'Loading…' : '載入中…'}</p>
        : current.error ? <p role="status" className="mt-2 text-xs text-amber-200">{english ? 'Timeline could not be loaded.' : '時間線暫時無法載入。'}</p>
        : current.events.length === 0 ? <p className="mt-2 text-xs text-slate-500">{english ? 'No reviewed events published yet.' : '尚無已核對並發布的事件。'}</p>
        : <ol className="mt-3 space-y-3 border-l border-accent/40 pl-3">
          {current.events.map((event) => (
            <li key={event.id} className="text-xs leading-5">
              <p className="text-slate-100">{eventLabels[event.event_type]?.[english ? 1 : 0] ?? event.event_type}{event.candidate_no ? `：${event.candidate_no}` : ''}</p>
              <p className="text-slate-400">
                {event.occurred_on ?? (english ? 'Event date not specified' : '來源未載明事件日期')}
                {event.source_published_on ? ` · ${english ? 'Source published' : '來源公告'} ${event.source_published_on}` : ''}
              </p>
              <a href={event.source_url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">{event.source_name} ↗</a>
            </li>
          ))}
        </ol>}
    </div>
  );
}

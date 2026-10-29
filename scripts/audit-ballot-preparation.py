"""Reconcile source corrections and receipt evidence without approving identity or writes."""
import argparse,collections,copy,csv,datetime,hashlib,importlib.util,json,pathlib,re,zipfile

def load_planner():
    spec=importlib.util.spec_from_file_location('ballot_plan',pathlib.Path(__file__).with_name('prepare-ballot-number-diff.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def apply_corrections(records,proposal,original_sha):
    if proposal['original_json_sha256'] != original_sha or proposal['original_row_count'] != len(records):
        raise ValueError('original source JSON mismatch')
    corrected=copy.deepcopy(records);seen=set()
    for item in proposal['corrections']:
        index=item['record_index_zero_based']
        if index in seen:raise ValueError('duplicate correction target')
        seen.add(index);row=corrected[index]
        if any(row.get(k)!=v for k,v in item['match'].items()) or any(row.get(k)!=v for k,v in item['before'].items()):
            raise ValueError('correction before-image mismatch')
        if set(item['proposed_after']) != {'candidate_name','name_raw','evidence_text'}:
            raise ValueError('correction cannot change identities, numbers, dates or approvals')
        if not item['proposed_after']['candidate_name'].strip():raise ValueError('blank corrected name')
        row.update(item['proposed_after']);row['source_correction']=copy.deepcopy(item)
    for hold in proposal['additional_holds']:
        row=corrected[hold['index']]
        if any(row[k]!=hold[k] for k in ('county','district','ballot_number')) or row['candidate_name']!=hold['stored_name']:
            raise ValueError('source glyph hold target mismatch')
        row['source_quality_hold']=copy.deepcopy(hold)
    return corrected

class PriorScopeDrift(ValueError):
    def __init__(self, drifts):
        super().__init__('prior baseline scope drift')
        self.drifts = drifts

def validate_prior(records,prior,baseline):
    if len(records)!=len(prior) or any(r.get('source_index')!=i or r.get('source')!=records[i] for i,r in enumerate(prior)):
        raise ValueError('prior diff does not match original source records')
    targets={(kind,t['before']['id']):t for group,kind in (('candidates','candidate'),('roster','registration_name')) for t in baseline[group]}
    drifts={}
    for i,row in enumerate(prior):
        if row['classification']=='unresolved':
            continue
        target=targets.get((row['subject_type'],row['subject_id']))
        if target is None or target['before']!=row['before']:
            raise ValueError('prior baseline before-image drift')
        latest={key:target[key] for key in ('race','election','region')}
        if latest!=row.get('scope_evidence'):
            drifts[i]={'prior_scope':copy.deepcopy(row.get('scope_evidence')),
                       'latest_scope':copy.deepcopy(latest),
                       'subject_type':row['subject_type'],'subject_id':row['subject_id']}
    if drifts:
        raise PriorScopeDrift(drifts)

def replan_corrected(original,corrected,prior,baseline,planner):
    drifts={}
    try:
        validate_prior(original,prior,baseline)
    except PriorScopeDrift as error:
        drifts=error.drifts
    # Recompute ALL rows together: scope, competing subjects, existing numbers
    # and events can change even when the former target's before-image does not.
    rows=planner.plan(corrected,baseline)
    for i,row in enumerate(rows):
        old=prior[i]
        if i in drifts:
            row['fresh_classification']=row['classification']
            row['prior_scope_drift']=drifts[i]
            row['classification']='unresolved'
            row['reason']='prior_target_scope_drift'
        elif (old['classification']!='unresolved' and row['classification']!='unresolved'
              and (old['subject_type'],old['subject_id'])!=(row['subject_type'],row['subject_id'])):
            row['prior_subject']={'subject_type':old['subject_type'],'subject_id':old['subject_id']}
            row['fresh_classification']=row['classification']
            row['classification']='unresolved'
            row['reason']='prior_target_changed'
        if row['classification']=='unresolved':
            for key in ('after','event_proposal','protected_fields','rollback_guard'):
                row.pop(key,None)
    planner.assert_unique_canonical_ballots(rows)
    return rows

def normalized_hint(value):
    # Suggestions only. Never used for automatic identity matching or aliases.
    return re.sub(r'[\s·•‧．・]+','',value or '')

def receipt_for(source,indexes):
    matches=[]
    for filename,items in indexes.items():
        for i,item in enumerate(items):
            digest=item.get('source_sha256') or item.get('sha256')
            urls=[item.get(k) for k in ('attachment_url','source_url','url')]
            if digest != source['source_sha256'] or source['evidence_url'] not in urls:continue
            value=item.get('retrieved_at_utc') or item.get('retrieved_at')
            if value:matches.append({'index_file':filename,'index_row':i,'raw_value':value,'source_sha256':digest})
    values={x['raw_value'] for x in matches}
    if not matches:return {'status':'unknown_no_receipt','fetched_at':None,'evidence':[]}
    if len(values)!=1:return {'status':'conflicting_receipts','fetched_at':None,'evidence':matches}
    value=next(iter(values))
    if '/' in value:return {'status':'interval_only','fetched_at':None,'retained_interval':value,'evidence':matches}
    try:
        parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
        if parsed.tzinfo is None:raise ValueError('timezone missing')
    except (ValueError,TypeError):return {'status':'invalid_receipt','fetched_at':None,'evidence':matches}
    return {'status':'exact_saved_receipt','fetched_at':value,'evidence':matches}

def explain_hold(source,baseline,planner):
    if not source['candidate_name'].strip():return 'blank_or_whitespace_source_name',[]
    candidates=[]
    for group in ('candidates','roster'):
        for t in baseline[group]:
            b=t['before'];name=(b.get('candidate_name') or t.get('person_name')) if group=='candidates' else b['display_name']
            scoped=planner.scope_matches(source,t)
            if scoped and (name==source['candidate_name'] or normalized_hint(name)==normalized_hint(source['candidate_name'])):
                candidates.append({'subject_type':group,'subject_id':b['id'],'person_id':b.get('person_id'),'name':name,
                    'candidate_external_id':b.get('external_id') or b.get('candidate_external_id'),'race_id':b['race_id'],
                    'race_title':t['race']['title'],'existing_source_url':b.get('source_url'),'existing_source_name':b.get('source_name'),
                    'match_level':'exact_name_scope' if name==source['candidate_name'] else 'normalized_name_scope_hint_only'})
    if source.get('source_quality_hold'):return 'source_separator_glyph_requires_reviewed_identity_evidence',candidates
    if any(c['match_level']=='exact_name_scope' for c in candidates):return 'exact_name_scope_but_registration_source_not_verified_cec',candidates
    if candidates:return 'full_name_representation_difference_hint_only',candidates
    return 'no_existing_full_name_and_scope_match',[]

def run(package,correction_package,baseline_path,prior_diff,output):
    planner=load_planner();baseline=json.loads(pathlib.Path(baseline_path).read_text())
    prior=json.loads(pathlib.Path(prior_diff).read_text());out=pathlib.Path(output);out.mkdir(parents=True,exist_ok=False)
    with zipfile.ZipFile(package) as z,zipfile.ZipFile(correction_package) as cz:
        raw=z.read('ballot-number-candidates.json');records=json.loads(raw);proposal=json.loads(cz.read('correction-proposal.json'))
        corrected=apply_corrections(records,proposal,hashlib.sha256(raw).hexdigest())
        indexes={name:json.loads(z.read(name)) for name in ('north/sources.json','central/source-index.json','south-east/records.json')}
        correction_indexes={c['record_index_zero_based'] for c in proposal['corrections']}
        rows=replan_corrected(records,corrected,prior,baseline,planner)
        holds=[];receipts=[]
        for i,row in enumerate(rows):
            row['source']=corrected[i]
            receipt=receipt_for(corrected[i],indexes);row['receipt_reconciliation']=receipt
            receipts.append({'source_index':i,**receipt})
            if corrected[i].get('source_quality_hold'):
                row['prior_mapping_proposal']=copy.deepcopy(prior[i]) if prior[i]['classification']!='unresolved' else None
                row['classification']='unresolved';row.pop('after',None);row.pop('event_proposal',None)
            if row['classification']=='unresolved':
                reason,hints=explain_hold(corrected[i],baseline,planner)
                if not corrected[i].get('source_quality_hold') and row.get('reason') in (
                    'prior_target_scope_drift','prior_target_changed','ambiguous_exact_matches'):
                    reason=row['reason']
                row['reason']=reason;row['candidate_hints_not_identity_approval']=hints
                s=corrected[i]
                holds.append({'source_index':i,'reason':reason,'county':s['county'],'district':s['district'],'name':s['candidate_name'],
                   'candidate_no':s['candidate_no'],'attachment_url':s['evidence_url'],'announcement_url':s['announcement_url'],
                   'source_sha256':s['source_sha256'],'page':s['source_page'],'original_evidence_line':records[i]['evidence_text'],
                   'source_quality_hold':s.get('source_quality_hold'),'candidate_hints_not_identity_approval':hints})
            elif receipt['fetched_at'] is not None:
                row['event_proposal']['fetched_at']=receipt['fetched_at']
                row['event_proposal']['fetched_at_provenance']=receipt['evidence']
                row['blockers']=[x for x in row['blockers'] if not x.startswith('source fetched_at requires')]
            row['executable']=False;row['approved_for_publication']=False
            row.setdefault('blockers',[]).extend(['human identity/publication review not granted','latest target schema and exact before-image not validated for application'])
        planner.assert_unique_canonical_ballots(rows)
        identities=[(r['subject_type'],r['subject_id']) for r in rows if r['classification']!='unresolved']
        if len(identities)!=len(set(identities)):raise ValueError('correction creates duplicate target')
        if any(not r['candidate_name'].strip() for r in corrected):raise ValueError('source names remain blank after overlay')
        summary={'total':len(rows),'all_rows_replanned':True,'canonical_ballot_uniqueness_checked':True,'counts':dict(collections.Counter(r['classification'] for r in rows)),
          'subjects':dict(collections.Counter(r.get('subject_type','unresolved') for r in rows if r['classification']!='unresolved')),
          'hold_reasons':dict(collections.Counter(h['reason'] for h in holds)),
          'receipt_status':dict(collections.Counter(r['status'] for r in receipts)),
          'nonblank_names':len(corrected),'corrections':len(correction_indexes),'source_glyph_holds':len(proposal['additional_holds']),
          'original_1090_remain_non_executable':all(not r['executable'] for r in rows),'identity_approval':False,'published':0}
        for name,value in [('diff.json',rows),('source-corrections-applied-copy.json',corrected),('holds.json',holds),('receipts.json',receipts),('summary.json',summary),('correction-proposal.json',proposal)]:
            (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf8')
        with (out/'holds.csv').open('w',encoding='utf-8-sig',newline='') as f:
            keys=['source_index','reason','county','district','name','candidate_no','attachment_url','source_sha256','page','original_evidence_line']
            writer=csv.DictWriter(f,fieldnames=keys,extrasaction='ignore');writer.writeheader();writer.writerows(holds)
    print(json.dumps(summary,ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for arg in ('package','correction-package','baseline','prior-diff','output'):p.add_argument('--'+arg,required=True)
    a=p.parse_args();run(a.package,a.correction_package,a.baseline,a.prior_diff,a.output)

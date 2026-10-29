import copy,importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('audit',pathlib.Path(__file__).with_name('audit-ballot-preparation.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class AuditTests(unittest.TestCase):
    def setUp(self):
        self.rows=[{'candidate_name':' ','name_raw':' ','evidence_text':'區 12 無','candidate_no':'12','district':'測試區','county':'測試市','ballot_number':12},
                   {'candidate_name':'佀廣洋','name_raw':'佀廣洋','evidence_text':'區 14 無','candidate_no':'14','district':'測試區','county':'測試市','ballot_number':14}]
        self.p={'original_json_sha256':'hash','original_row_count':2,'additional_holds':[],
                'corrections':[{'record_index_zero_based':0,'match':{'candidate_no':'12','district':'測試區'},
                 'before':{k:self.rows[0][k] for k in ('candidate_name','name_raw','evidence_text')},
                 'proposed_after':{'candidate_name':'王妃天崩開局穿越整頓霸凌者佀廣洋','name_raw':'王妃天崩開局穿越\n整頓霸凌者佀廣洋','evidence_text':'two line cell'}}]}
    def test_multiline_overlay_does_not_mutate_original_or_neighbour(self):
        before=copy.deepcopy(self.rows);out=m.apply_corrections(self.rows,self.p,'hash')
        self.assertEqual(self.rows,before);self.assertEqual(out[1],before[1]);self.assertNotEqual(out[0]['candidate_name'],out[1]['candidate_name'])
        self.assertIn('\n',out[0]['name_raw'])
    def test_before_drift_rejected(self):
        self.rows[0]['candidate_name']='different'
        with self.assertRaisesRegex(ValueError,'before-image'):m.apply_corrections(self.rows,self.p,'hash')
    def test_correction_cannot_approve_or_reassign(self):
        self.p['corrections'][0]['proposed_after']['person_id']='invented'
        with self.assertRaisesRegex(ValueError,'cannot change'):m.apply_corrections(self.rows,self.p,'hash')
    def test_whitespace_only_corrected_name_rejected(self):
        self.p['corrections'][0]['proposed_after']['candidate_name']=' \t\n'
        with self.assertRaisesRegex(ValueError,'blank'):m.apply_corrections(self.rows,self.p,'hash')
    def test_glyph_difference_is_hold_not_alias(self):
        self.p['additional_holds']=[{'index':1,'county':'測試市','district':'測試區','ballot_number':14,'stored_name':'佀廣洋','table_name_raw':'字(cid:504)字'}]
        out=m.apply_corrections(self.rows,self.p,'hash')
        self.assertEqual(out[1]['candidate_name'],'佀廣洋');self.assertIn('source_quality_hold',out[1])
        self.assertNotIn('person_id',out[1])
    def test_stale_prior_mapping_rejected(self):
        baseline={'candidates':[{'before':{'id':'c','candidate_no':None}}],'roster':[]}
        prior=[{'source_index':i,'source':copy.deepcopy(row),'classification':'unresolved'} for i,row in enumerate(self.rows)]
        m.validate_prior(self.rows,prior,baseline)
        prior[0].update(classification='new',subject_type='candidate',subject_id='c',before={'id':'c','candidate_no':'wrong'})
        with self.assertRaisesRegex(ValueError,'before-image drift'):m.validate_prior(self.rows,prior,baseline)
        prior[0]['source']['candidate_no']='99'
        with self.assertRaisesRegex(ValueError,'original source'):m.validate_prior(self.rows,prior,baseline)
    def test_exact_receipt_not_publication_or_now(self):
        source={'source_sha256':'s','evidence_url':'https://x/pdf'}
        indexes={'record.json':[{'source_sha256':'s','attachment_url':'https://x/pdf','retrieved_at_utc':'2026-10-28T03:34:35Z'}]}
        self.assertEqual(m.receipt_for(source,indexes)['fetched_at'],'2026-10-28T03:34:35Z')
        indexes['record.json'][0]['retrieved_at_utc']='2026-10-28T03:32:00Z/2026-10-28T03:35:43Z'
        result=m.receipt_for(source,indexes);self.assertEqual(result['status'],'interval_only');self.assertIsNone(result['fetched_at'])
        self.assertIsNone(m.receipt_for(source,{})['fetched_at'])

class ReplanGuardTests(unittest.TestCase):
    def setUp(self):
        spec=importlib.util.spec_from_file_location('planner_tests',pathlib.Path(__file__).with_name('test_prepare_ballot_number_diff.py'))
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        case=module.BallotTests();case.setUp()
        self.planner=m.load_planner();self.source=case.source;self.baseline=case.baseline
        self.prior=self.planner.plan([self.source],self.baseline)
    def replan(self,baseline):
        return m.replan_corrected([self.source],[copy.deepcopy(self.source)],self.prior,baseline,self.planner)[0]
    def test_election_race_region_scope_drift_becomes_hold(self):
        for part,key,value in [('election','year',2022),('election','id','e2'),
              ('race','title','changed'),('race','race_type','county_mayor'),
              ('race','election_id','e2'),('region','name','別市'),('region','id','g2')]:
            with self.subTest(part=part,key=key):
                baseline=copy.deepcopy(self.baseline);baseline['candidates'][0][part][key]=value
                with self.assertRaises(m.PriorScopeDrift):m.validate_prior([self.source],self.prior,baseline)
                row=self.replan(baseline)
                self.assertEqual(row['classification'],'unresolved');self.assertEqual(row['reason'],'prior_target_scope_drift')
                self.assertNotIn('after',row);self.assertNotIn('event_proposal',row)
                self.assertEqual(row['prior_scope_drift']['latest_scope'][part][key],value)
    def test_nonmatching_scope_metadata_drift_also_holds(self):
        baseline=copy.deepcopy(self.baseline);baseline['candidates'][0]['race']['status']='changed'
        row=self.replan(baseline)
        self.assertEqual(row['fresh_classification'],'new');self.assertEqual(row['classification'],'unresolved')
    def test_new_competing_target_is_rechecked(self):
        baseline=copy.deepcopy(self.baseline);other=copy.deepcopy(baseline['candidates'][0])
        other['before'].update(id='c2',external_id='second');baseline['candidates'].append(other)
        row=self.replan(baseline)
        self.assertEqual(row['reason'],'ambiguous_exact_matches');self.assertNotIn('event_proposal',row)
    def test_new_occupied_number_is_rechecked(self):
        baseline=copy.deepcopy(self.baseline);other=copy.deepcopy(baseline['candidates'][0])
        other['before'].update(id='c2',external_id='second',candidate_name='別人',candidate_no='2');baseline['candidates'].append(other)
        row=self.replan(baseline)
        self.assertEqual(row['classification'],'conflict');self.assertEqual(row['after'],row['before'])
    def test_existing_events_are_reloaded(self):
        baseline=copy.deepcopy(self.baseline);baseline['events']=[{'candidate_id':'c1','external_id':'newly-existing'}]
        row=self.replan(baseline)
        self.assertEqual(row['existing_events'],baseline['events']);self.assertIn('existing event reconciliation required',row['blockers'])
    def test_audit_full_batch_rejects_canonical_collision(self):
        source2=copy.deepcopy(self.source);source2.update(candidate_name='另一姓名',district='測試市第一選區')
        baseline=copy.deepcopy(self.baseline);other=copy.deepcopy(baseline['candidates'][0])
        other['before'].update(id='c2',external_id='second',candidate_name='另一姓名');baseline['candidates'].append(other)
        prior2=self.planner.plan([source2],baseline)[0];prior2['source_index']=1
        with self.assertRaisesRegex(ValueError,'canonical election/race'):
            m.replan_corrected([self.source,source2],[self.source,source2],self.prior+[prior2],baseline,self.planner)

if __name__=='__main__':unittest.main()

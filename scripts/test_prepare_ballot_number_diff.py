import copy
import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('ballot',pathlib.Path(__file__).with_name('prepare-ballot-number-diff.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class BallotTests(unittest.TestCase):
    def setUp(self):
        self.source={'election_year':2026,'county':'測試市','office':'市議員','district':'測試市第1選舉區','candidate_name':'完整姓名','ballot_number':2,'candidate_no':'2','source_sha256':'a'*64,'announcement_url':'https://web.cec.gov.tw/test/article/1','evidence_url':'https://web.cec.gov.tw/api/file/test.pdf','source_page':1,'draw_date':None,'source_date':'2026-10-27'}
        self.target={'before':{'id':'c1','external_id':'existing-id','person_id':'p1','race_id':'r1','candidate_name':'完整姓名','candidate_no':None,'registration_status':'disqualified','party':'保留','source_url':'https://web.cec.gov.tw/api/file/old.pdf','is_public':False,'updated_at':'unchanged'},'race':{'id':'r1','election_id':'e1','region_id':'g1','race_type':'city_councilor','title':'測試市第1選舉區議員選舉'},'election':{'id':'e1','year':2026},'region':{'id':'g1','name':'測試市'}}
        self.baseline={'candidates':[self.target],'roster':[],'events':[]}
    def plan(self):
        return m.plan([self.source],self.baseline)[0]
    def test_only_number_changes_and_no_promotion(self):
        original=copy.deepcopy(self.baseline);r=self.plan()
        self.assertEqual(self.baseline,original)
        self.assertEqual([k for k in r['before'] if r['before'][k]!=r['after'][k]],['candidate_no'])
        self.assertFalse(r['executable']);self.assertFalse(r['event_proposal']['is_public'])
        self.assertIsNone(r['event_proposal']['occurred_on'])
    def test_same_and_conflict_never_replace(self):
        for old,expected in [('2','same'),('3','conflict')]:
            self.target['before']['candidate_no']=old;r=self.plan()
            self.assertEqual(r['classification'],expected);self.assertEqual(r['after'],r['before'])
    def test_wrong_scope_and_name_hold(self):
        for field,value in [('candidate_name','簡稱'),('county','別市'),('district','測試市第2選舉區'),('election_year',2022),('office','市長')]:
            old=self.source[field];self.source[field]=value
            self.assertEqual(self.plan()['classification'],'unresolved');self.source[field]=old
    def test_chinese_district_label_is_only_scope_conversion(self):
        self.source['district']='測試市第一選區'
        self.assertEqual(self.plan()['classification'],'new')
        self.source['district']='測試市第二選區'
        self.assertEqual(self.plan()['classification'],'unresolved')
        self.source['district']='測試市第十一一選區'
        self.assertEqual(self.plan()['classification'],'unresolved')
    def test_blank_name_holds(self):
        for name in ('', ' ', '\t\n'):
            self.source['candidate_name']=name;self.assertEqual(self.plan()['reason'],'missing_source_name')
    def test_district_number_with_explicit_indigenous_label(self):
        self.target['race']['title']='測試市第1選舉區山地原住民議員選舉'
        self.assertEqual(self.plan()['classification'],'new')
        self.target['race']['title']='測試市第2選舉區山地原住民議員選舉'
        self.assertEqual(self.plan()['classification'],'unresolved')
    def test_number_rejects_malformed(self):
        for value in ('3abc',0,-1,True,'02',' 2',2.5,'1'*21):
            with self.assertRaises(ValueError):m.number(value)
    def test_ambiguous_identity_holds(self):
        other=copy.deepcopy(self.target);other['before']['id']='c2';self.baseline['candidates'].append(other)
        self.assertEqual(self.plan()['reason'],'ambiguous_exact_matches')
    def test_unofficial_source_holds(self):
        self.target['before']['source_url']='https://cec.gov.tw.evil.test/a'
        self.assertEqual(self.plan()['classification'],'unresolved')
    def test_existing_race_number_collision_holds(self):
        other=copy.deepcopy(self.target);other['before'].update(id='c2',candidate_name='別人',candidate_no='2')
        self.baseline['candidates'].append(other);r=self.plan()
        self.assertEqual(r['classification'],'conflict');self.assertEqual(r['before'],r['after'])
    def test_duplicate_source_rejected(self):
        with self.assertRaisesRegex(ValueError,'duplicate ballot'):m.plan([self.source,self.source],self.baseline)
    def test_roster_never_creates_person(self):
        r=copy.deepcopy(self.target);r['before']={'id':'n1','candidate_external_id':'roster-id','race_id':'r1','display_name':'完整姓名','source_url':'https://web.cec.gov.tw/a','is_public':True}
        self.baseline={'candidates':[],'roster':[r],'events':[]};out=self.plan()
        self.assertEqual(out['subject_type'],'registration_name');self.assertIsNone(out['person_id'])
        self.assertEqual(out['after'],out['before']);self.assertIsNone(out['event_proposal']['candidate_id'])
    def test_existing_event_blocks_duplicate(self):
        self.baseline['events']=[{'candidate_id':'c1','external_id':'existing-event'}]
        self.assertIn('existing event reconciliation required',self.plan()['blockers'])
    def test_canonical_race_number_collision_across_district_labels(self):
        other=copy.deepcopy(self.target);other['before'].update(id='c2',external_id='second',candidate_name='另一姓名')
        self.baseline['candidates'].append(other)
        source2=copy.deepcopy(self.source);source2.update(candidate_name='另一姓名',district='測試市第一選區')
        with self.assertRaisesRegex(ValueError,'canonical election/race'):
            m.plan([self.source,source2],self.baseline)
    def test_same_subject_district_alias_duplicate_rejected(self):
        source2=copy.deepcopy(self.source);source2['district']='測試市第一選區'
        with self.assertRaisesRegex(ValueError,'one subject'):
            m.plan([self.source,source2],self.baseline)
    def test_same_number_in_different_canonical_races_allowed(self):
        other=copy.deepcopy(self.target);other['before'].update(id='c2',external_id='second',candidate_name='另一姓名',race_id='r2')
        other['race'].update(id='r2',title='測試市第2選舉區議員選舉')
        self.baseline['candidates'].append(other)
        source2=copy.deepcopy(self.source);source2.update(candidate_name='另一姓名',district='測試市第二選區')
        self.assertEqual([r['classification'] for r in m.plan([self.source,source2],self.baseline)],['new','new'])
    def test_scope_snapshot_does_not_alias_mutable_baseline(self):
        proposal=self.plan();self.target['election']['year']=2022
        self.assertEqual(proposal['scope_evidence']['election']['year'],2026)
    def test_inconsistent_scope_ids_do_not_match(self):
        for part,key in [('race','id'),('race','election_id'),('race','region_id')]:
            old=self.target[part][key];self.target[part][key]='wrong'
            self.assertEqual(self.plan()['classification'],'unresolved');self.target[part][key]=old
    def test_repeated_dry_run_stable_event_key(self):
        self.assertEqual(self.plan(),self.plan())

if __name__=='__main__':unittest.main()

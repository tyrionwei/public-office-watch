import importlib.util
from pathlib import Path
import unittest

def load(filename):
    spec=importlib.util.spec_from_file_location(filename,Path(__file__).with_name(filename+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

g=load('grassroots-grouped-checks');b=load('build-grassroots-compaction-plan')

class GroupedChecksTest(unittest.TestCase):
    def test_boundary_blocks_after_ten_and_checks_tail(self):
        self.assertEqual([g.next_boundary(x) for x in (27,37,47,57)],[37,47,57,60])
        for x in (0,1,30):
            with self.assertRaises(ValueError):g.next_boundary(27,interval=x)

    def test_original_writes_order_locks_and_deadline(self):
        writes="UPDATE public.candidates t SET candidate_name='END IF;';\nUPDATE published.candidate_facts SET person_id=NULL;\nDELETE FROM public.people WHERE false;\n"
        sql=b.transaction("IF true THEN NULL; END IF;\n"+writes+"IF false THEN NULL; END IF;\n")
        requests=b.forward_requests(b.SEGMENT_BOUNDARY.join(b.segment_forward_transaction(sql)))
        out=g.forward_dml(requests)
        self.assertEqual(''.join(out[2:-1]),writes)
        self.assertEqual(out[:2],requests[:2]);self.assertEqual(out[-1],requests[-1])
        with self.assertRaises(ValueError):g.forward_dml(requests[:-1])

    def test_name_link_visibility_and_unrelated_fields(self):
        rows=[{'id':'a','person_id':'p','race_id':'r','is_public':False,'votes':7}, {'id':'b','person_id':'q','race_id':'s','is_public':True,'votes':9}]
        out=g.expected_rows('public.candidates',rows,{'p'},{'a'},{'p':{'name':'fallback'}},{'a':{'name':'public'}})
        self.assertEqual(out[0],dict(rows[0],person_id=None,candidate_name='public',is_public=True))
        self.assertEqual(out[1],dict(rows[1],candidate_name=None))
        self.assertEqual(rows[0]['person_id'],'p')
        self.assertEqual(g.expected_public([{'id':'a','person_id':'canonical','name':'public'},{'id':'b','person_id':'q'}],{'a'}),[{'id':'a','person_id':None,'name':'public'},{'id':'b','person_id':'q'}])

    def test_cascades_and_facts_preserve_unrelated_data(self):
        rows=[{'candidate_id':'a','person_id':'p','person_party':'X','person_position':'Y','votes':7}]
        out=g.expected_rows('published.candidate_facts',rows,{'p'},{'a'},{},{})
        self.assertEqual(out,[dict(rows[0],person_id=None,person_party=None,person_position=None)])
        edges=[{'id':'edge','duplicate_person_id':'q','canonical_person_id':'p'}]
        self.assertEqual(g.expected_rows('public.person_merge_decisions',edges,{'p'},set(),{},{}),[])
        with self.assertRaises(ValueError):g.expected_rows('unknown',[{}],set(),set(),{}, {})

if __name__=='__main__':unittest.main()

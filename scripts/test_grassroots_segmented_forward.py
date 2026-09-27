"""Regression checks for fixed forward packages, never production authorization."""
import importlib.util
from pathlib import Path
import unittest

s=importlib.util.spec_from_file_location('plan',Path(__file__).with_name('build-grassroots-compaction-plan.py'));g=importlib.util.module_from_spec(s);s.loader.exec_module(g)

class SegmentedForwardTest(unittest.TestCase):
    def source(self):
        body="IF EXISTS(SELECT 1 WHERE false) THEN RAISE EXCEPTION 'before'; END IF;\n"
        body+="UPDATE public.candidates t SET candidate_name='literal END IF; and COMMIT;';\n"
        body+="UPDATE published.candidate_facts SET person_id=NULL;\nDELETE FROM public.people WHERE false;\n"
        body+="IF EXISTS(SELECT 1 WHERE false) THEN RAISE EXCEPTION 'after'; END IF;\n"
        return g.transaction(body)

    def test_payloads_order_and_single_transaction_preserved(self):
        source=self.source();requests=g.segment_forward_transaction(source)
        bodies=[r.split(' BEGIN\n',1)[1].rsplit('END $segment_',1)[0] for r in requests[2:-1]]
        original=source.split(' BEGIN\n',1)[1].rsplit('END $grassroots_',1)[0]
        self.assertEqual(''.join(bodies),original)
        self.assertEqual(requests[-1],'COMMIT;\n')
        self.assertEqual(requests[0],"SET transaction_timeout = '5min';\n")
        self.assertIn("BEGIN;\n",requests[1])
        self.assertIn("SET LOCAL lock_timeout = '5s';",requests[1])
        encoded=g.SEGMENT_BOUNDARY.join(requests)
        self.assertEqual(g.forward_requests(encoded),requests)

    def test_reverse_and_extra_write_rejected(self):
        for old,new in [('UPDATE public.candidates t SET','INSERT INTO public.candidates VALUES'),('DELETE FROM public.people WHERE','DELETE FROM public.other WHERE')]:
            with self.assertRaises(ValueError):g.segment_forward_transaction(self.source().replace(old,new))

    def test_trailing_transaction_or_missing_deadline_rejected(self):
        with self.assertRaises(ValueError):g.segment_forward_transaction(self.source()+'BEGIN;\n')
        encoded=g.SEGMENT_BOUNDARY.join(g.segment_forward_transaction(self.source()))
        with self.assertRaises(ValueError):g.forward_requests(encoded.replace("SET transaction_timeout = '5min';\n",''))

    def test_corrupted_segment_rejected(self):
        encoded=g.SEGMENT_BOUNDARY.join(g.segment_forward_transaction(self.source()))
        with self.assertRaises(ValueError):g.forward_requests(encoded.replace("RAISE EXCEPTION 'before'","RAISE EXCEPTION 'changed'"))

if __name__=='__main__':unittest.main()

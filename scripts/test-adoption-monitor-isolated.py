from pathlib import Path
import subprocess, time, json, uuid
from adoption_monitor import activity_sql, cancel_sql, BlockingWindow, classify
import argparse
a=argparse.ArgumentParser();a.add_argument('--evidence-dir',type=Path,required=True);args=a.parse_args()
o=args.evidence_dir.resolve();o.mkdir(parents=True,exist_ok=True);results=[]
cmd=['docker','exec','-i','supabase_db_public-office-watch','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','pow_combined_release_20261029']
def query(sql):
    v=subprocess.run(cmd,input=sql,text=True,capture_output=True,timeout=15)
    assert v.returncode==0, v.stderr[-1200:]
    return v.stdout.strip()
def actors(label):return json.loads(query(activity_sql(label)))
def wait_actor(label):
    end=time.monotonic()+5
    while time.monotonic()<end:
        a=actors(label)
        if a:return a[0]
        time.sleep(.1)
    raise AssertionError('actor not observed')
def launch(sql):
    v=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    v.stdin.write(sql);v.stdin.close();v.stdin=None
    return v
assert query('SELECT current_database()')=='pow_combined_release_20261029'
schema='monitor_'+uuid.uuid4().hex[:12]
query(f'CREATE SCHEMA {schema}; CREATE TABLE {schema}.receipt(id int primary key,value int); INSERT INTO {schema}.receipt VALUES(1,0);')
try:
    # Simulate lost HTTP response: don't consume actor's result until independent reconciliation.
    tag='pow62-test-'+uuid.uuid4().hex[:16]
    a=launch(f"BEGIN; SET LOCAL application_name='{tag}'; SET LOCAL statement_timeout='5s'; SET LOCAL transaction_timeout='6s'; UPDATE {schema}.receipt SET value=1; SELECT pg_sleep(1); COMMIT;")
    actor=wait_actor(tag)
    assert classify(False,True)=='running'
    assert query(f'SELECT value FROM {schema}.receipt')=='0' # uncommitted marker invisible
    a.communicate(timeout=8);assert a.returncode==0
    assert classify(query(f'SELECT value FROM {schema}.receipt')=='1',bool(actors(tag)),exact_after=True)=='committed'
    results.append({'test':'lost response independently reconciled as committed','pass':True})
    query(f'UPDATE {schema}.receipt SET value=0')
    other='pow62-other-'+uuid.uuid4().hex[:16]
    unrelated=launch(f"BEGIN; SET LOCAL application_name='{other}'; SELECT pg_sleep(4); ROLLBACK;")
    wait_actor(other)
    tag='pow62-test-'+uuid.uuid4().hex[:16]
    a=launch(f"BEGIN; SET LOCAL application_name='{tag}'; SET LOCAL statement_timeout='8s'; SET LOCAL transaction_timeout='9s'; SET LOCAL idle_in_transaction_session_timeout='2s'; LOCK TABLE {schema}.receipt IN ACCESS EXCLUSIVE MODE; UPDATE {schema}.receipt SET value=2; SELECT pg_sleep(7); COMMIT;")
    actor=wait_actor(tag)
    reader=launch(f"SET statement_timeout='8s'; SELECT value FROM {schema}.receipt;")
    wrong=dict(actor,backend_start='2000-01-01T00:00:00Z')
    assert json.loads(query(cancel_sql(wrong)))==[]
    wrong=dict(actor,xact_start='2000-01-01T00:00:00Z')
    assert json.loads(query(cancel_sql(wrong)))==[]
    assert a.poll() is None
    window=BlockingWindow(.3); end=time.monotonic()+4
    while time.monotonic()<end:
        actor=actors(tag)[0]
        if window.observe(actor,time.monotonic()):break
        time.sleep(.1)
    else:raise AssertionError('continuous reader block not observed')
    signaled=json.loads(query(cancel_sql(actor)))
    assert len(signaled)==1 and signaled[0]['signal_sent'] is True
    a.communicate(timeout=4);assert a.returncode!=0
    assert unrelated.poll() is None, 'unrelated backend was disturbed'
    out,err=reader.communicate(timeout=4);assert reader.returncode==0 and out.strip()=='0'
    assert classify(False,bool(actors(tag)),exact_before=query(f'SELECT value FROM {schema}.receipt')=='0')=='rolled-back'
    unrelated.communicate(timeout=6);assert unrelated.returncode==0
    results.append({'test':'reader blocking cancellation exact tuple; wrong tuples reject; unrelated session intact; rollback','pass':True})
    tag='pow62-test-'+uuid.uuid4().hex[:16]
    a=launch(f"BEGIN; SET LOCAL application_name='{tag}'; SET LOCAL statement_timeout='3s'; SET LOCAL transaction_timeout='1s'; UPDATE {schema}.receipt SET value=3; SELECT pg_sleep(2); COMMIT;")
    wait_actor(tag);out,err=a.communicate(timeout=5)
    assert a.returncode!=0 and 'transaction timeout' in err
    assert not actors(tag) and query(f'SELECT value FROM {schema}.receipt')=='0'
    results.append({'test':'server transaction deadline independently terminates and rolls back','pass':True})
    assert classify(False,False)=='uncertain'
    assert classify(True,False)=='uncertain'
    w=BlockingWindow(10); fake={'blockers':[{'pid':1,'backend_start':'a','query_start':'q'}]}
    assert not w.observe(fake,0);assert not w.observe({'blockers':[]},9)
    assert not w.observe(fake,10);assert w.observe(fake,20)
    results.append({'test':'ambiguous outcomes never replay; blocking continuity resets','pass':True})
finally:
    query(f'DROP TABLE {schema}.receipt; DROP SCHEMA {schema};')
(o/'MONITOR-ISOLATED-RESULT.json').write_text(json.dumps({'results':results,'productionWrites':0,'productionBlockingThresholdSeconds':10,'isolationThresholdSeconds':.3},indent=2))
print(json.dumps(results))

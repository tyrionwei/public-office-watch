"""Run synthetic ballot SQL in a new network-none, tmpfs-only disposable Postgres.

Never connects to a pre-existing database or reads application credentials.
"""
import argparse,hashlib,json,pathlib,subprocess,time,uuid

IMAGE='sha256:93700b025491b90f6837549d59db5e8bbe8a12cb002dc5f7fefbdc8e3ee56381'

def run(bootstrap,migration,fixture,output):
    out=pathlib.Path(output);out.mkdir(parents=True,exist_ok=False)
    name='pow-ballot-fixture-'+uuid.uuid4().hex[:12];cid=None
    def command(args,**kwargs):
        return subprocess.run(args,text=True,capture_output=True,**kwargs)
    def sql(text,expected=True,label='query'):
        result=command(['docker','exec','-i',cid,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],input=text)
        (out/(label+'.log')).write_text(result.stdout+result.stderr)
        if expected and result.returncode:raise RuntimeError(label+': '+result.stderr[-2500:])
        return result
    def snapshot(label):
        result=sql("SELECT jsonb_build_object('candidates',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.candidates t),'roster',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.registration_name_roster t),'events',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.candidate_lifecycle_events t),'races',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.races t),'elections',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.elections t));",label=label)
        return json.loads(result.stdout)
    try:
        result=command(['docker','run','--detach','--rm','--pull=never','--name',name,
          '--label','pow.task=ballot-fixture-20261028','--network','none','--read-only',
          '--tmpfs','/tmp:rw,nosuid,nodev,size=256m','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=16m',
          '--user','postgres','--memory','512m','--cpus','1','--entrypoint','/bin/sh',IMAGE,'-c',
          'initdb -D /tmp/ballot-db --auth=trust --no-locale && exec postgres -D /tmp/ballot-db -c listen_addresses= -c unix_socket_directories=/tmp'])
        if result.returncode:raise RuntimeError('container creation failed: '+result.stderr)
        cid=result.stdout.strip();assert len(cid)==64
        inspect=json.loads(command(['docker','inspect',cid],check=True).stdout)[0]
        assert inspect['Image']==IMAGE and inspect['HostConfig']['NetworkMode']=='none'
        assert not inspect['HostConfig']['PortBindings'] and not inspect['HostConfig']['Binds']
        assert all(m['Type']=='tmpfs' for m in inspect['Mounts'])
        assert inspect['Config']['Labels']['pow.task']=='ballot-fixture-20261028'
        (out/'target.json').write_text(json.dumps({'container_id':cid,'name':name,'image':IMAGE,'network':'none','published_ports':[],'host_binds':[],'mounts':inspect['Mounts']},indent=2))
        for attempt in range(30):
            ready=command(['docker','exec',cid,'pg_isready','-h','/tmp','-U','postgres'])
            if ready.returncode==0:break
            time.sleep(1)
        else:raise RuntimeError('isolated startup timeout: '+command(['docker','logs',cid]).stdout[-1500:])
        sql(pathlib.Path(bootstrap).read_text(),label='bootstrap')
        original_function=sql("SELECT pg_get_functiondef('published.registration_names_for(uuid[])'::regprocedure);",label='original-function').stdout
        sql("DO $$ BEGIN EXECUTE replace(pg_get_functiondef('published.registration_names_for(uuid[])'::regprocedure),'LIMIT 2001','LIMIT 2000'); END $$;",label='introduce-synthetic-drift')
        negative=sql(pathlib.Path(migration).read_text(),expected=False,label='drift-rejected')
        assert negative.returncode!=0 and 'Unexpected registration_names_for definition' in negative.stderr
        assert sql("SELECT count(*) FROM pg_constraint WHERE conname='candidate_ballot_number_payload';",label='negative-no-constraint').stdout.strip()=='0'
        sql(original_function,label='restore-synthetic-original-function')
        before=snapshot('before-migration')
        sql(pathlib.Path(migration).read_text(),label='migration')
        assert snapshot('after-migration')==before,'schema migration changed business rows'
        sql(pathlib.Path(fixture).read_text(),label='fixture')
        assert snapshot('after-fixture-rollback')==before,'fixture rollback did not restore exact data'
        # No current research schema or credentials are involved in this synthetic test.
        result={'status':'passed','baseline':'synthetic minimal main RPC schema, not full migration replay',
          'main_sha':'15f7629394d904652768e53d64a2460b13ba2fe1','schema_drift_rejected':True,
          'migration_business_rows_unchanged':True,'fixture_exact_data_rollback':True,
          'migration_sha256':hashlib.sha256(pathlib.Path(migration).read_bytes()).hexdigest(),
          'fixture_sha256':hashlib.sha256(pathlib.Path(fixture).read_bytes()).hexdigest()}
        (out/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
    finally:
        if cid:
            inspected=command(['docker','inspect',cid])
            if inspected.returncode==0:
                meta=json.loads(inspected.stdout)[0]
                assert meta['Config']['Labels'].get('pow.task')=='ballot-fixture-20261028' and meta['Name']=='/'+name
                stopped=command(['docker','stop','--time','5',cid]);(out/'cleanup.log').write_text(stopped.stdout+stopped.stderr)
                if stopped.returncode:raise RuntimeError('own fixture container cleanup failed')
            gone=command(['docker','inspect',cid]);assert gone.returncode!=0,'fixture container still exists'
            (out/'cleanup-verified.json').write_text(json.dumps({'container_id':cid,'removed':True,'tmpfs_only':True}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for option in ('bootstrap','migration','fixture','output'):parser.add_argument('--'+option,required=True)
    a=parser.parse_args();run(a.bootstrap,a.migration,a.fixture,a.output)

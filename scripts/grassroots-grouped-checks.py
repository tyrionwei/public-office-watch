"""Grouped full checks for fixed maintenance packages, never automatic recovery.

Callers must verify package hashes, the stopped prefix and exclusive maintenance.
Only the full row/view comparisons move to group boundaries. Per-batch target
checks, row counts, transaction deadlines and capacity gates remain mandatory.
"""
import re


def forward_dml(requests):
    if requests[0] != "SET transaction_timeout = '5min';\n" or requests[-1] != 'COMMIT;\n':
        raise ValueError('Missing transaction deadline/envelope')
    if 'BEGIN;\n' not in requests[1] or "SET LOCAL lock_timeout = '5s';" not in requests[1]:
        raise ValueError('Missing original transaction locks/settings')
    writes = []
    for request in requests[2:-1]:
        match = re.fullmatch(r'DO (\$segment_[a-f0-9]{64}\$) BEGIN\n(.*)END \1;\n', request, re.S)
        if not match:
            raise ValueError('Expected a hash-verified generated segment')
        body = match.group(2)
        if not body.startswith('IF '):
            writes.append(body)
    prefixes = ('UPDATE public.candidates t SET', 'UPDATE published.candidate_facts SET', 'DELETE FROM public.people WHERE')
    if len(writes) != 3 or any(not text.startswith(prefix) for text, prefix in zip(writes, prefixes)):
        raise ValueError('Unexpected fixed forward writes')
    return [requests[0], requests[1], *writes, requests[-1]]


def next_boundary(verified_prefix, total=60, interval=10):
    if interval not in (10, 20) or not 0 <= verified_prefix < total:
        raise ValueError('Unsupported checkpoint boundary')
    return min(verified_prefix + interval, total)


def expected_rows(table, rows, touched, candidate_ids, scope, visible):
    result = []
    for row in rows:
        value = dict(row)
        if table == 'public.candidates':
            value['candidate_name'] = None
            if value['person_id'] in touched:
                name = visible[value['id']]['name'] if value['id'] in visible else scope[value['person_id']]['name']
                value.update(person_id=None, candidate_name=name, is_public=value['id'] in visible)
        elif table == 'published.candidate_facts':
            if value['candidate_id'] in candidate_ids:
                value.update(person_id=None, person_party=None, person_position=None)
        elif table == 'public.people':
            if value['id'] in touched:
                continue
        elif table == 'public.person_merge_decisions':
            if value['duplicate_person_id'] in touched or value['canonical_person_id'] in touched:
                continue
        elif table in ('public.person_claims', 'public.person_identity_matches', 'public.person_party_affiliations', 'published.person_demographics'):
            if value['person_id'] in touched:
                continue
        else:
            raise ValueError('Unrecognized checkpoint table')
        result.append(value)
    return result


def expected_public(rows, candidate_ids):
    return [dict(row, person_id=None) if row['id'] in candidate_ids else dict(row) for row in rows]

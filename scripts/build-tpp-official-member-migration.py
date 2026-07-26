#!/usr/bin/env python3
"""Build the reviewed TPP member seed and local migration from saved official pages."""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "data-sources/tpp/member-match-report.json"
SEED_PATH = ROOT / "data-sources/tpp/official-members.seed.json"
MIGRATION_PATH = ROOT / "supabase/migrations/202607260003_tpp_official_members.sql"
OBSERVED_DATE = "2026-07-26"
PARTY_NAME = "台灣民眾黨"

MANUAL_MATCHES = {
    "林瑞祥": "04ef36cd-a2c4-4cbe-8dfe-050387260c65",
    "林碩彥": "c2513cc0-a97f-4d04-8a32-01c4fcdfe300",
    "林耀宗": "0631b7eb-bf8c-480f-96ae-98d8a5dee316",
    "張志豪": "6cdf9eab-203b-47f9-9d30-6629a112cdd4",
    "張凱鈞": "6b6e13f3-3c56-4bf5-831f-a035dcdbc4c2",
    "許忠信": "3426e556-d1c6-4694-8b2a-2c03c57f5171",
    "許願神": "594f889a-0867-4a3a-bda5-beaf494e889e",
    "劉美蘭": "4065733f-9ad8-4feb-a7e8-72f4c6ce588e",
    "繆宗翰": "b4595907-451e-46fb-8e78-7e50863dfbe9",
}

UNRESOLVED_NAMES = {"李偉華", "陳永祥"}

NEW_PERSON_NAMES = {
    "余志修", "吳士廉", "吳皇昇", "李彥慶", "李頂立", "李嘉雯",
    "林韋銘", "林富男", "徐文路", "張彤", "陳智菡", "曾鼎文",
    "葉郁慧", "廖志杰", "廖偉宏", "劉昱鴻", "謝泊泓", "簡幸甫",
}


def stable_uuid(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"https://www.tpp.org.tw/member/{name}"))


def stable_key(name: str) -> str:
    return hashlib.sha1(name.encode("utf-8")).hexdigest()[:16]


def clean_current_role(value: str) -> str:
    value = re.sub(r"[（(]現職[）)]", "", value).strip()
    value = value.replace("台灣民眾黨中央黨部", "").replace("台灣民眾黨", "")
    return value.strip()


def party_staff_roles(item: dict[str, object]) -> list[dict[str, object]]:
    name = str(item["name"])
    groups = list(item["role_groups"])
    current_roles = [clean_current_role(role) for role in item["current_party_roles"]]
    roles: list[dict[str, object]] = []

    if current_roles:
        for index, role in enumerate(current_roles):
            roles.append({
                "role_context": "party_officer",
                "role_title": role,
                "organization_unit": "中央黨部",
                "display_order": 1 if role == "主席" else 10 + index,
            })
        return roles

    if "發言人" in groups:
        return [{
            "role_context": "party_officer",
            "role_title": "發言人",
            "organization_unit": "中央黨部",
            "display_order": 30,
        }]

    if name == "柯文哲":
        return [{
            "role_context": "party_officer",
            "role_title": "創黨主席",
            "organization_unit": "中央黨部",
            "display_order": 40,
        }]

    if "立法院黨團" in groups:
        roles.append({
            "role_context": "party_officer",
            "role_title": "黨團黨職人員",
            "organization_unit": "立法院黨團",
            "display_order": 80,
        })
    if "中央黨部" in groups:
        roles.append({
            "role_context": "party_officer",
            "role_title": "中央黨部黨職人員",
            "organization_unit": "中央黨部",
            "display_order": 100,
        })
    return roles


def affiliation_roles(item: dict[str, object]) -> list[dict[str, object]]:
    roles: list[dict[str, object]] = []
    categories = list(item["categories"])
    groups = list(item["role_groups"])

    if "黨職人員" in categories:
        roles.extend(party_staff_roles(item))
    if "中央委員會" in categories:
        for group in groups:
            if group in {"當然委員", "指定委員", "票選委員"}:
                roles.append({
                    "role_context": "party_officer",
                    "role_title": f"中央委員（{group}）",
                    "organization_unit": "中央委員會",
                    "display_order": {"當然委員": 200, "指定委員": 210, "票選委員": 220}[group],
                })
    if "中央評議委員會" in categories:
        is_chair = any("中央評議委員會主任委員" in value for value in item["experience"])
        roles.append({
            "role_context": "party_officer",
            "role_title": "中央評議委員會主任委員" if is_chair else "中央評議委員",
            "organization_unit": "中央評議委員會",
            "display_order": 300 if is_chair else 310,
        })
    for category, order in {
        "立法委員": 400,
        "縣市議員": 410,
        "鄉鎮市民代表": 420,
        "村里長": 430,
    }.items():
        if category in categories:
            roles.append({
                "role_context": "officeholder",
                "role_title": category,
                "organization_unit": None,
                "display_order": order,
            })

    unique: dict[tuple[str, str, str | None], dict[str, object]] = {}
    for role in roles:
        key = (str(role["role_context"]), str(role["role_title"]), role["organization_unit"])
        unique[key] = role
    return list(unique.values())


def primary_position(roles: list[dict[str, object]]) -> str:
    priority = {"立法委員": 1, "縣市議員": 2, "鄉鎮市民代表": 3, "村里長": 4}
    public_roles = [role for role in roles if role["role_context"] == "officeholder"]
    if public_roles:
        return str(min(public_roles, key=lambda role: priority.get(str(role["role_title"]), 99))["role_title"])
    return str(min(roles, key=lambda role: int(role["display_order"]))["role_title"]) if roles else "黨務人員"


def build_seed() -> dict[str, object]:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    profiles: list[dict[str, object]] = []
    for item in report["matches"]:
        name = item["name"]
        if name in NEW_PERSON_NAMES:
            person_id = stable_uuid(name)
            match_method = "official_current_roster_new_person"
            score = 100
            create_person = True
        elif item["match_status"] == "unique_name":
            person_id = item["candidates"][0]["person_id"]
            match_method = "official_current_roster_unique_name"
            score = 94
            create_person = False
        elif name in MANUAL_MATCHES:
            person_id = MANUAL_MATCHES[name]
            match_method = "official_current_roster_name_role"
            score = 98
            create_person = False
        elif item["match_status"] == "not_found":
            person_id = stable_uuid(name)
            match_method = "official_current_roster_new_person"
            score = 100
            create_person = True
        elif name in UNRESOLVED_NAMES:
            person_id = None
            match_method = "needs_manual_identity_review"
            score = 0
            create_person = False
        else:
            raise RuntimeError(f"Unreviewed ambiguous person: {name}")

        roles = affiliation_roles(item)
        experience = [value for value in item["experience"] if not re.search(r"[（(]現職[）)]", value)]
        profiles.append({
            "source_person_key": f"official-site:tpp:current:{stable_key(name)}",
            "person_id": person_id,
            "create_person": create_person,
            "name": name,
            "position": primary_position(roles),
            "categories": item["categories"],
            "roles": roles,
            "education": item["education"],
            "experience": experience,
            "source_urls": item["source_urls"],
            "source_url": item["source_urls"][0],
            "match_method": match_method,
            "match_score": score,
        })

    return {
        "source_name": "台灣民眾黨：現任黨公職",
        "observed_date": OBSERVED_DATE,
        "party_name": PARTY_NAME,
        "profiles": profiles,
    }


def build_migration(seed: dict[str, object]) -> str:
    profiles_json = json.dumps(seed["profiles"], ensure_ascii=False, separators=(",", ":"))
    return f"""-- Generated by scripts/build-tpp-official-member-migration.py from saved official HTML snapshots.
CREATE TEMP TABLE _tpp_official_profiles AS
SELECT *
FROM jsonb_to_recordset($profiles${profiles_json}$profiles$::JSONB) AS profile(
    source_person_key TEXT,
    person_id UUID,
    create_person BOOLEAN,
    name TEXT,
    position TEXT,
    categories JSONB,
    roles JSONB,
    education JSONB,
    experience JSONB,
    source_urls JSONB,
    source_url TEXT,
    match_method TEXT,
    match_score NUMERIC
);

INSERT INTO people (id, name, party, position, source_url, is_public, created_at, updated_at)
SELECT person_id, name, '{PARTY_NAME}', position, source_url, TRUE, NOW(), NOW()
FROM _tpp_official_profiles
WHERE create_person = TRUE
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    party = EXCLUDED.party,
    position = COALESCE(people.position, EXCLUDED.position),
    source_url = EXCLUDED.source_url,
    is_public = TRUE,
    updated_at = NOW();

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, party, normalized_party, position,
    source_payload, confidence_suggestion, ingest_batch_key, is_public, updated_at
)
SELECT
    source_person_key,
    'official_site',
    'tpp-current-' || SUBSTRING(source_person_key FROM '[^:]+$'),
    '台灣民眾黨：現任黨公職',
    source_url,
    name,
    name,
    '{PARTY_NAME}',
    '{PARTY_NAME}',
    position,
    jsonb_build_object(
        'categories', categories,
        'roles', roles,
        'education', education,
        'experience', experience,
        'sourceUrls', source_urls,
        'observedDate', '{OBSERVED_DATE}',
        'dateSemantics', 'official_roster_observed_date'
    ),
    'A',
    'tpp-official-current-members-20260726',
    TRUE,
    NOW()
FROM _tpp_official_profiles
ON CONFLICT (source_person_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    party = EXCLUDED.party,
    normalized_party = EXCLUDED.normalized_party,
    position = EXCLUDED.position,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO person_identity_matches (
    source_person_id, person_id, match_status, score, match_method, match_reason,
    evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    source.id,
    profile.person_id,
    'auto_matched',
    profile.match_score,
    profile.match_method,
    CASE
        WHEN profile.create_person THEN 'Official current party roster created a previously absent public party officer.'
        ELSE 'Official current party roster matched by reviewed name, current party, and role context.'
    END,
    jsonb_build_object('sourcePersonKey', profile.source_person_key, 'observedDate', '{OBSERVED_DATE}'),
    'system:tpp-official-current-members',
    NOW(),
    NOW()
FROM _tpp_official_profiles profile
JOIN source_people source ON source.source_person_key = profile.source_person_key
WHERE profile.person_id IS NOT NULL
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = NOW();

WITH claim_rows AS (
    SELECT
        profile.*,
        claim.claim_type,
        claim.items,
        ARRAY_TO_STRING(ARRAY(SELECT jsonb_array_elements_text(claim.items)), '；') AS claim_value
    FROM _tpp_official_profiles profile
    CROSS JOIN LATERAL (
        VALUES ('education', profile.education), ('experience', profile.experience)
    ) AS claim(claim_type, items)
    WHERE profile.person_id IS NOT NULL
      AND jsonb_array_length(claim.items) > 0
)
INSERT INTO person_claims (
    claim_key, person_id, source_person_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, updated_at
)
SELECT
    claim.source_person_key || ':' || claim.claim_type,
    claim.person_id,
    source.id,
    claim.claim_type,
    claim.claim_value,
    source.source_payload || jsonb_build_object('field', claim.claim_type),
    'A',
    'verified',
    'public',
    '台灣民眾黨：現任黨公職',
    claim.source_url,
    TIMESTAMPTZ '{OBSERVED_DATE} 00:00:00+08',
    TRUE,
    100,
    'official-party-roster-v1',
    jsonb_build_array('Official party roster and profile snapshot.'),
    NOW(),
    NOW()
FROM claim_rows claim
JOIN source_people source ON source.source_person_key = claim.source_person_key
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    source_person_id = EXCLUDED.source_person_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = NOW();

WITH role_rows AS (
    SELECT profile.*, role.*
    FROM _tpp_official_profiles profile
    CROSS JOIN LATERAL jsonb_to_recordset(profile.roles) AS role(
        role_context TEXT,
        role_title TEXT,
        organization_unit TEXT,
        display_order INT
    )
    WHERE profile.person_id IS NOT NULL
), keyed_roles AS (
    SELECT role.*,
        CASE
            WHEN role.name = '黃國昌' AND role.role_context = 'party_officer' AND role.role_title = '主席'
                THEN 'tpp:2025-chair:huang-kuo-chang'
            ELSE role.source_person_key || ':role:' || MD5(role.role_context || ':' || role.role_title || ':' || COALESCE(role.organization_unit, ''))
        END AS affiliation_key
    FROM role_rows role
)
INSERT INTO person_party_affiliations (
    affiliation_key, person_id, source_person_id, party_name, normalized_party,
    role_context, role_title, organization_unit, display_order,
    observed_year, observed_date, is_current, confidence_level, review_status,
    source_name, source_url, source_payload, is_public, created_at, updated_at
)
SELECT
    role.affiliation_key,
    role.person_id,
    source.id,
    '{PARTY_NAME}',
    '{PARTY_NAME}',
    role.role_context,
    role.role_title,
    role.organization_unit,
    role.display_order,
    2026,
    DATE '{OBSERVED_DATE}',
    TRUE,
    'A',
    'verified',
    '台灣民眾黨：現任黨公職',
    role.source_url,
    source.source_payload || jsonb_build_object(
        'roleTitle', role.role_title,
        'organizationUnit', role.organization_unit,
        'dateSemantics', 'official_roster_observed_date'
    ),
    TRUE,
    NOW(),
    NOW()
FROM keyed_roles role
JOIN source_people source ON source.source_person_key = role.source_person_key
ON CONFLICT (affiliation_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    source_person_id = EXCLUDED.source_person_id,
    party_name = EXCLUDED.party_name,
    normalized_party = EXCLUDED.normalized_party,
    role_context = EXCLUDED.role_context,
    role_title = EXCLUDED.role_title,
    organization_unit = EXCLUDED.organization_unit,
    display_order = EXCLUDED.display_order,
    observed_year = EXCLUDED.observed_year,
    observed_date = EXCLUDED.observed_date,
    is_current = EXCLUDED.is_current,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_payload = EXCLUDED.source_payload,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

UPDATE people person
SET party = '{PARTY_NAME}', updated_at = NOW()
FROM _tpp_official_profiles profile
WHERE profile.person_id = person.id
  AND profile.person_id IS NOT NULL
  AND person.party IS DISTINCT FROM '{PARTY_NAME}';

UPDATE parties
SET
    chairperson_name = '黃國昌',
    source_name = '台灣民眾黨：現任黨公職',
    source_url = 'https://www.tpp.org.tw/member/1',
    updated_at = NOW()
WHERE name = '{PARTY_NAME}';

REFRESH MATERIALIZED VIEW public_people_list_cached;
"""


def main() -> None:
    seed = build_seed()
    SEED_PATH.write_text(json.dumps(seed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MIGRATION_PATH.write_text(build_migration(seed), encoding="utf-8")
    resolved = sum(profile["person_id"] is not None for profile in seed["profiles"])
    created = sum(profile["create_person"] for profile in seed["profiles"])
    print(f"Wrote {len(seed['profiles'])} profiles ({resolved} resolved, {created} new) to seed and migration")


if __name__ == "__main__":
    main()

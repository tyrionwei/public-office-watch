WITH canonical_parties(name, canonical_slug) AS (
    VALUES
        ('中國國民黨', 'kmt'),
        ('台灣團結聯盟', 'tsu'),
        ('台灣基進', 'tsp'),
        ('台灣民眾黨', 'tpp'),
        ('小民參政歐巴桑聯盟', 'obasang-alliance'),
        ('新黨', 'new-party'),
        ('時代力量', 'npp'),
        ('民主進步黨', 'dpp'),
        ('社會民主黨', 'sdp'),
        ('綠黨', 'green-party'),
        ('親民黨', 'pfp')
)
DELETE FROM parties duplicate
USING canonical_parties mapping, parties canonical
WHERE duplicate.name = mapping.name
  AND canonical.name = mapping.name
  AND canonical.slug = mapping.canonical_slug
  AND duplicate.id <> canonical.id
  AND duplicate.source_name = 'VoteTW historical election results'
  AND NOT EXISTS (
      SELECT 1
      FROM party_finance_summaries summary
      WHERE summary.party_id = duplicate.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM party_company_contribution_summaries summary
      WHERE summary.party_id = duplicate.id
  );

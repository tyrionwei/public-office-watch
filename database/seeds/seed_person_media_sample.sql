INSERT INTO person_media (
    person_id,
    media_type,
    url,
    thumbnail_url,
    source_name,
    source_url,
    license_type,
    license_url,
    attribution,
    is_primary,
    verification_status,
    is_public
)
VALUES (
    (SELECT id FROM people WHERE name = '測試人物A' LIMIT 1),
    'photo',
    'https://example.com/placeholders/test-person-a-avatar.png',
    'https://example.com/placeholders/test-person-a-avatar-thumb.png',
    'Local placeholder',
    'https://example.com/placeholder',
    'placeholder',
    'https://example.com/placeholder-license',
    'Placeholder image for UI testing only',
    TRUE,
    'verified',
    FALSE
)
ON CONFLICT DO NOTHING;

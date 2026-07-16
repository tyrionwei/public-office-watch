UPDATE races
SET
    race_type = 'township_mayor',
    updated_at = NOW()
WHERE race_type = 'local_chief'
  AND (
      title ~ '(鄉長|鎮長|區長)選舉$'
      OR title ~ '縣.+市市長選舉$'
  );

COMMENT ON COLUMN races.race_type IS
    'Election office type. township_mayor includes elected township, town, county-administered city, and indigenous district chiefs.';

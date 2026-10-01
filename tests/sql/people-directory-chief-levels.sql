DO $test$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('屏東縣長治鄉鄉長',NULL,NULL),('臺東縣長濱鄉鄉長',NULL,NULL),
 ('屏東縣長治鄉第1區鄉民代表',NULL,NULL),('苗栗縣頭份市市長',NULL,NULL),
 ('新竹縣竹北市市長',NULL,NULL),('宜蘭市長',NULL,NULL),('斗六市長',NULL,NULL),
 ('臺北市市長',NULL,'local_chief'),('新竹市長',NULL,'local_chief'),
 ('新竹縣縣長',NULL,'local_chief'),('曾任臺南市市長',NULL,'local_chief'),
 ('市長','新竹市','local_chief'),('市長','新竹縣竹北市',NULL),('市長',NULL,NULL),
 ('副市長','新竹市','local_deputy'),('新竹縣竹北市副市長',NULL,NULL),
 ('新竹市副市長',NULL,'local_deputy'),('臺北市長候選人',NULL,'local_chief'),
 ('縣長',NULL,'local_chief'),('縣市長',NULL,'local_chief'),('直轄市長',NULL,'local_chief')
 ) AS t(label,district,expected) LOOP
  IF public.people_directory_chief_role(item.label,item.district) IS DISTINCT FROM item.expected THEN
   RAISE EXCEPTION 'Chief level mismatch: % / %',item.label,item.district;
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM published.people_directory WHERE list_role IN ('local_chief','local_deputy') AND coalesce(current_office_label,upcoming_candidate_label,position,'')~'(鄉長|鎮長|鄉民代表|縣.+市市長)') THEN
  RAISE EXCEPTION 'Lower-level office remains in the chief directory';
 END IF;
END;
$test$;
SELECT list_role,list_status,count(*) FROM published.people_directory WHERE list_role IN ('local_chief','local_deputy') GROUP BY 1,2 ORDER BY 1,2;

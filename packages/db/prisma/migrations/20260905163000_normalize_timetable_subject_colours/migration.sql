UPDATE "Subject"
SET "timetableColour" = CASE
  WHEN "code" = 'MATH' OR lower("name") ~ '(^|[^[:alnum:]])math(s|ematics)?([^[:alnum:]]|$)'
    THEN 'Yellow'::"TimetableColour"
  WHEN "code" = 'ENG' OR lower("name") ~ '(^|[^[:alnum:]])english([^[:alnum:]]|$)'
    THEN 'Red'::"TimetableColour"
  WHEN "code" = 'LIT' OR lower("name") ~ '(^|[^[:alnum:]])literature([^[:alnum:]]|$)'
    THEN 'PaleRed'::"TimetableColour"
  WHEN "code" = 'WB' OR lower("name") ~ 'word[[:space:]]*building'
    THEN 'Purple'::"TimetableColour"
  WHEN "code" = 'ANSCI' OR lower("name") ~ 'animal[[:space:]]*science'
    THEN 'LightBlue'::"TimetableColour"
  WHEN "code" = 'SCI' OR lower("name") ~ '(^|[^[:alnum:]])science([^[:alnum:]]|$)'
    THEN 'DarkBlue'::"TimetableColour"
  WHEN "code" = 'SOC' OR lower("name") ~ 'social[[:space:]]*studies'
    THEN 'Green'::"TimetableColour"
  WHEN "code" = 'BIBLE' OR lower("name") ~ 'bible[[:space:]]*studies'
    THEN 'Brown'::"TimetableColour"
  ELSE 'Grey'::"TimetableColour"
END;

UPDATE "StudentTimetablePublicationEntry" AS entry
SET "subjectColour" = subject."timetableColour"
FROM "Subject" AS subject
WHERE entry."subjectId" = subject."id"
  AND entry."subjectColour" IS DISTINCT FROM subject."timetableColour";

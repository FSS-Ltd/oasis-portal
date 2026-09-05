CREATE TYPE "TimetableRegistrationLevel" AS ENUM ('ABC', 'Primary', 'Secondary');
CREATE TYPE "TimetableSlotKind" AS ENUM ('Lesson', 'Break');
CREATE TYPE "TimetableDay" AS ENUM ('Tuesday', 'Wednesday', 'Thursday', 'Friday');
CREATE TYPE "TimetableColour" AS ENUM (
  'Yellow', 'Red', 'PaleRed', 'Purple', 'DarkBlue', 'LightBlue', 'Green', 'Brown', 'Grey'
);

ALTER TABLE "PersonalTask" ADD COLUMN "timetableTermKey" TEXT;
ALTER TABLE "Subject" ADD COLUMN "timetableColour" "TimetableColour" NOT NULL DEFAULT 'Grey';

UPDATE "Subject" SET "timetableColour" = CASE "code"
  WHEN 'MATH' THEN 'Yellow'::"TimetableColour"
  WHEN 'ENG' THEN 'Red'::"TimetableColour"
  WHEN 'LIT' THEN 'PaleRed'::"TimetableColour"
  WHEN 'WB' THEN 'Purple'::"TimetableColour"
  WHEN 'SCI' THEN 'DarkBlue'::"TimetableColour"
  WHEN 'ANSCI' THEN 'LightBlue'::"TimetableColour"
  WHEN 'SOC' THEN 'Green'::"TimetableColour"
  WHEN 'BIBLE' THEN 'Brown'::"TimetableColour"
  ELSE 'Grey'::"TimetableColour"
END;

INSERT INTO "Subject" ("id", "code", "name", "active", "timetableColour") VALUES
  ('subject-animal-science', 'ANSCI', 'Animal Science', true, 'LightBlue'),
  ('subject-bible-studies', 'BIBLE', 'Bible Studies', true, 'Brown')
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "timetableColour" = EXCLUDED."timetableColour";

CREATE TABLE "TimetableAgeGroupSchedule" (
  "id" TEXT NOT NULL,
  "termKey" TEXT NOT NULL,
  "registrationLevel" "TimetableRegistrationLevel" NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableAgeGroupSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableScheduleSlot" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "kind" "TimetableSlotKind" NOT NULL,
  "label" TEXT NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableScheduleSlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimetableScheduleSlot_time_check" CHECK (
    "startMinutes" >= 0 AND "startMinutes" < 1440
    AND "endMinutes" > "startMinutes" AND "endMinutes" <= 1440
  )
);

CREATE TABLE "StudentTimetable" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "termKey" TEXT NOT NULL,
  "registrationLevel" "TimetableRegistrationLevel" NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentTimetable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentTimetableEntry" (
  "id" TEXT NOT NULL,
  "timetableId" TEXT NOT NULL,
  "day" "TimetableDay" NOT NULL,
  "slotId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentTimetableEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentTimetablePublication" (
  "id" TEXT NOT NULL,
  "timetableId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "termKey" TEXT NOT NULL,
  "termLabel" TEXT NOT NULL,
  "termStartsOn" DATE NOT NULL,
  "termEndsOn" DATE NOT NULL,
  "registrationLevel" "TimetableRegistrationLevel" NOT NULL,
  "studentFirstNameEnc" TEXT NOT NULL,
  "publishedById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentTimetablePublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentTimetablePublicationEntry" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "day" "TimetableDay" NOT NULL,
  "slotPosition" INTEGER NOT NULL,
  "slotKind" "TimetableSlotKind" NOT NULL,
  "slotLabel" TEXT NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "subjectId" TEXT,
  "subjectName" TEXT,
  "subjectColour" "TimetableColour",
  CONSTRAINT "StudentTimetablePublicationEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentTimetablePublicationEntry_time_check" CHECK (
    "startMinutes" >= 0 AND "startMinutes" < 1440
    AND "endMinutes" > "startMinutes" AND "endMinutes" <= 1440
  ),
  CONSTRAINT "StudentTimetablePublicationEntry_subject_check" CHECK (
    ("slotKind" = 'Break' AND "subjectId" IS NULL AND "subjectName" IS NULL AND "subjectColour" IS NULL)
    OR "slotKind" = 'Lesson'
  )
);

CREATE UNIQUE INDEX "PersonalTask_ownerId_timetableTermKey_key"
  ON "PersonalTask"("ownerId", "timetableTermKey");
CREATE UNIQUE INDEX "TimetableAgeGroupSchedule_termKey_registrationLevel_key"
  ON "TimetableAgeGroupSchedule"("termKey", "registrationLevel");
CREATE INDEX "TimetableAgeGroupSchedule_updatedById_updatedAt_idx"
  ON "TimetableAgeGroupSchedule"("updatedById", "updatedAt");
CREATE UNIQUE INDEX "TimetableScheduleSlot_scheduleId_position_key"
  ON "TimetableScheduleSlot"("scheduleId", "position");
CREATE INDEX "TimetableScheduleSlot_scheduleId_kind_position_idx"
  ON "TimetableScheduleSlot"("scheduleId", "kind", "position");
CREATE UNIQUE INDEX "StudentTimetable_studentId_termKey_key"
  ON "StudentTimetable"("studentId", "termKey");
CREATE INDEX "StudentTimetable_scheduleId_idx" ON "StudentTimetable"("scheduleId");
CREATE INDEX "StudentTimetable_updatedById_updatedAt_idx"
  ON "StudentTimetable"("updatedById", "updatedAt");
CREATE UNIQUE INDEX "StudentTimetableEntry_timetableId_day_slotId_key"
  ON "StudentTimetableEntry"("timetableId", "day", "slotId");
CREATE INDEX "StudentTimetableEntry_slotId_idx" ON "StudentTimetableEntry"("slotId");
CREATE INDEX "StudentTimetableEntry_subjectId_idx" ON "StudentTimetableEntry"("subjectId");
CREATE INDEX "StudentTimetablePublication_studentId_termKey_publishedAt_idx"
  ON "StudentTimetablePublication"("studentId", "termKey", "publishedAt");
CREATE INDEX "StudentTimetablePublication_timetableId_publishedAt_idx"
  ON "StudentTimetablePublication"("timetableId", "publishedAt");
CREATE INDEX "StudentTimetablePublication_publishedById_publishedAt_idx"
  ON "StudentTimetablePublication"("publishedById", "publishedAt");
CREATE UNIQUE INDEX "StudentTimetablePublicationEntry_publicationId_day_slotPosition_key"
  ON "StudentTimetablePublicationEntry"("publicationId", "day", "slotPosition");

ALTER TABLE "TimetableAgeGroupSchedule" ADD CONSTRAINT "TimetableAgeGroupSchedule_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableScheduleSlot" ADD CONSTRAINT "TimetableScheduleSlot_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "TimetableAgeGroupSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTimetable" ADD CONSTRAINT "StudentTimetable_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTimetable" ADD CONSTRAINT "StudentTimetable_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "TimetableAgeGroupSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTimetable" ADD CONSTRAINT "StudentTimetable_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTimetableEntry" ADD CONSTRAINT "StudentTimetableEntry_timetableId_fkey"
  FOREIGN KEY ("timetableId") REFERENCES "StudentTimetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTimetableEntry" ADD CONSTRAINT "StudentTimetableEntry_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "TimetableScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTimetableEntry" ADD CONSTRAINT "StudentTimetableEntry_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTimetablePublication" ADD CONSTRAINT "StudentTimetablePublication_timetableId_fkey"
  FOREIGN KEY ("timetableId") REFERENCES "StudentTimetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTimetablePublication" ADD CONSTRAINT "StudentTimetablePublication_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTimetablePublication" ADD CONSTRAINT "StudentTimetablePublication_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTimetablePublicationEntry" ADD CONSTRAINT "StudentTimetablePublicationEntry_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "StudentTimetablePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimetableAgeGroupSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableAgeGroupSchedule" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TimetableScheduleSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableScheduleSlot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetable" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetableEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetableEntry" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetablePublication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetablePublication" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetablePublicationEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentTimetablePublicationEntry" FORCE ROW LEVEL SECURITY;

CREATE POLICY timetable_schedule_head_all ON "TimetableAgeGroupSchedule" FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY timetable_slot_head_all ON "TimetableScheduleSlot" FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY student_timetable_head_all ON "StudentTimetable" FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY student_timetable_entry_head_all ON "StudentTimetableEntry" FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY timetable_publication_head_all ON "StudentTimetablePublication" FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY timetable_publication_parent_select ON "StudentTimetablePublication" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentTimetablePublication"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );
CREATE POLICY timetable_publication_student_select ON "StudentTimetablePublication" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentTimetablePublication"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );
CREATE POLICY timetable_publication_entry_head_all ON "StudentTimetablePublicationEntry" FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY timetable_publication_entry_parent_select ON "StudentTimetablePublicationEntry" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "StudentTimetablePublication" p
      JOIN "Guardian" g ON g."studentId" = p."studentId"
      WHERE p."id" = "StudentTimetablePublicationEntry"."publicationId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );
CREATE POLICY timetable_publication_entry_student_select ON "StudentTimetablePublicationEntry" FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1
      FROM "StudentTimetablePublication" p
      JOIN "Student" s ON s."id" = p."studentId"
      WHERE p."id" = "StudentTimetablePublicationEntry"."publicationId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

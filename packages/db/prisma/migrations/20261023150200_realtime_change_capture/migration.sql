-- A transaction-local accumulator implemented as an always-empty committed table.
-- Each (transaction, recipient, area) writes once, flushes once, then deletes before
-- commit. Rollbacks undo both accumulation and realtime.send inserts. No event ledger.
CREATE TABLE oasis_private.model_coverage (model text PRIMARY KEY, areas text[] NOT NULL, audience text NOT NULL);
ALTER TABLE oasis_private.model_coverage ENABLE ROW LEVEL SECURITY;
INSERT INTO oasis_private.model_coverage (model,areas,audience) VALUES
('User',ARRAY['admin','profile','student','registration','staffHome','health','attendance','behaviour','club','calendar','notice','message','report','rota','invoice','incident','studentSettings','personalTask','compliance','userAgreement']::text[],'identity'),
('Guardian',ARRAY['admin','profile','student','registration','staffHome','health','behaviour','childLog','pace','meritLedger','investment','shop','leaderboard','club','calendar','notice','message','report','invoice','permissionSlip','incident']::text[],'identity'),
('AdultCompliance',ARRAY['compliance','staffHome']::text[],'compliance'),
('PersonalTask',ARRAY['personalTask','staffHome']::text[],'own'),
('UserInvitation',ARRAY['registration','admin','student','profile']::text[],'registration'),
('StudentRegistrationCode',ARRAY['registration','admin','student']::text[],'registration'),
('StudentSelfRegistration',ARRAY['registration','admin','student']::text[],'registration'),
('StudentParentLinkRequest',ARRAY['registration','admin','student']::text[],'registration'),
('ParentRegistration',ARRAY['registration','admin','student']::text[],'registration'),
('RegistrationGuardianContact',ARRAY['registration','admin','student']::text[],'registration'),
('RegistrationEmergencyContact',ARRAY['registration','admin','student']::text[],'registration'),
('RegistrationPickupContact',ARRAY['registration','admin','student']::text[],'registration'),
('StudentRegistrationProfile',ARRAY['registration','admin','student','compliance']::text[],'registration'),
('StudentRegistrationConsent',ARRAY['registration','admin','student']::text[],'registration'),
('Student',ARRAY['student','profile','staffHome','timetable','club','report','admin','attendance','behaviour','childLog','childNotes','pace','meritLedger','tithe','investment','shop','leaderboard','calendar','message','community','invoice','permissionSlip','incident','studentSettings','faithCorner','studentNotification','homework','academicInventory','personalTask','library','health']::text[],'student'),
('LibraryBook',ARRAY['library','staffHome']::text[],'library'),
('LibraryLoan',ARRAY['library','staffHome']::text[],'library'),
('LibraryEmailReminder',ARRAY[]::text[],'excluded'),
('StudentPortalUsageMinute',ARRAY['studentSettings','student','attendance','pace','meritLedger','investment','shop','leaderboard','club','faithCorner','studentNotification','homework']::text[],'usage'),
('UserAgreementDelivery',ARRAY['userAgreement','compliance']::text[],'agreement'),
('AuditLog',ARRAY['audit']::text[],'audit'),
('StudentPortalSettings',ARRAY['studentSettings','profile','student','attendance','pace','meritLedger','investment','shop','leaderboard','club','faithCorner','studentNotification','homework']::text[],'student'),
('StudentNotification',ARRAY['studentNotification','staffHome','student','behaviour','shop','club','homework']::text[],'student'),
('HomeworkAssignment',ARRAY['homework','staffHome']::text[],'homework'),
('HomeworkAssignmentBand',ARRAY['homework','staffHome']::text[],'homework'),
('HomeworkSubmission',ARRAY['homework','staffHome']::text[],'homework'),
('HomeworkSubmissionImage',ARRAY['homework','staffHome']::text[],'homework'),
('HomeworkAssignmentImage',ARRAY['homework','staffHome']::text[],'homework'),
('Subject',ARRAY['pace','academicInventory','report','staffHome','admin','student','timetable','childLog','leaderboard']::text[],'pace'),
('StudentSubject',ARRAY['pace','academicInventory','report','staffHome','student','studentSettings','childLog','leaderboard']::text[],'pace'),
('PaceGapPlan',ARRAY['pace','academicInventory','report','staffHome','student']::text[],'pace'),
('PaceGapPlanItem',ARRAY['pace','academicInventory','report','staffHome','student']::text[],'pace'),
('PaceRecord',ARRAY['pace','academicInventory','report','staffHome','student','childLog','leaderboard']::text[],'pace'),
('PaceProgress',ARRAY['pace','academicInventory','report','staffHome','student','childLog','leaderboard']::text[],'pace'),
('PacePolicy',ARRAY['pace','academicInventory','report','staffHome','admin','student','childLog','leaderboard']::text[],'pace'),
('PaceAdvancementApproval',ARRAY['pace','academicInventory','report','staffHome','student','childLog','leaderboard']::text[],'pace'),
('PaceInventoryOrder',ARRAY['pace','academicInventory','report','staffHome']::text[],'pace'),
('StudentPaceSupply',ARRAY['pace','academicInventory','report','staffHome']::text[],'pace'),
('DiagnosticResult',ARRAY['pace','academicInventory','report','staffHome','student','childLog','leaderboard']::text[],'pace'),
('TimetableAgeGroupSchedule',ARRAY['timetable','student','rota','staffHome']::text[],'timetable'),
('TimetableScheduleSlot',ARRAY['timetable','student','rota','staffHome']::text[],'timetable'),
('StudentTimetable',ARRAY['timetable','student','rota','staffHome']::text[],'timetable'),
('StudentTimetableEntry',ARRAY['timetable','student','rota','staffHome']::text[],'timetable'),
('StudentTimetablePublication',ARRAY['timetable','student','rota','staffHome','personalTask']::text[],'timetable'),
('StudentTimetablePublicationEntry',ARRAY['timetable','student','rota','staffHome']::text[],'timetable'),
('YearGroupBand',ARRAY['timetable','student','rota','staffHome','admin','attendance','behaviour','childLog','childNotes','pace','club','calendar','homework']::text[],'timetable'),
('Attendance',ARRAY['attendance','childLog','staffHome','report','student','studentSettings']::text[],'student'),
('SpecialAttendanceSession',ARRAY['attendance','childLog','staffHome','report']::text[],'student'),
('SpecialAttendanceRecord',ARRAY['attendance','childLog','staffHome','report']::text[],'student'),
('StaffAttendance',ARRAY['attendance','rota','staffHome']::text[],'staff'),
('StaffAvailabilityWindow',ARRAY['attendance','rota','staffHome']::text[],'staff'),
('StaffMonthlyAvailabilityWindow',ARRAY['attendance','rota','staffHome']::text[],'staff'),
('ParentVolunteerDay',ARRAY['attendance','rota','staffHome']::text[],'staff'),
('StaffLunchAndClubsVolunteerDay',ARRAY['attendance','rota','staffHome']::text[],'staff'),
('StaffShift',ARRAY['attendance','rota','staffHome','student','behaviour','childLog','childNotes','pace','club','calendar']::text[],'staff'),
('ShiftSwapRequest',ARRAY['attendance','rota','staffHome']::text[],'staff'),
('BehaviourEntry',ARRAY['behaviour','childLog','childNotes','meritLedger','leaderboard','report','staffHome','pace','tithe']::text[],'behaviour'),
('DemeritStageOverride',ARRAY['behaviour','childLog','childNotes','meritLedger','leaderboard','report','staffHome']::text[],'behaviour'),
('ChildNote',ARRAY['childNotes','childLog','staffHome','report']::text[],'notes'),
('MeritLedger',ARRAY['meritLedger','investment','shop','leaderboard','staffHome','student','childLog','tithe','report','studentSettings']::text[],'student'),
('TitheConfig',ARRAY['tithe','meritLedger','investment']::text[],'student'),
('TitheRun',ARRAY['tithe','meritLedger','investment']::text[],'student'),
('SavingsInterestRun',ARRAY['tithe','meritLedger','investment']::text[],'student'),
('InvestmentAccount',ARRAY['investment','meritLedger','staffHome']::text[],'student'),
('InvestmentHolding',ARRAY['investment','meritLedger','staffHome','leaderboard']::text[],'student'),
('InvestmentTransaction',ARRAY['investment','meritLedger','staffHome','leaderboard']::text[],'student'),
('InvestmentDividendPayment',ARRAY['investment','meritLedger','staffHome']::text[],'student'),
('InvestmentNav',ARRAY['investment','staffHome']::text[],'market'),
('InvestmentInstrument',ARRAY['investment','staffHome']::text[],'market'),
('MarketDataSnapshot',ARRAY['investment','staffHome']::text[],'market'),
('InvestmentNewsItem',ARRAY['investment','staffHome']::text[],'market'),
('InvestmentDividendEvent',ARRAY['investment','staffHome']::text[],'market'),
('CharityPot',ARRAY['tithe','meritLedger','staffHome','leaderboard']::text[],'market'),
('ShopItem',ARRAY['shop','staffHome','student']::text[],'market'),
('ShopPurchase',ARRAY['shop','meritLedger','staffHome']::text[],'student'),
('ShopReservation',ARRAY['shop','meritLedger','staffHome']::text[],'student'),
('ShopReservationLine',ARRAY['shop','meritLedger','staffHome']::text[],'student'),
('LeaderboardSnapshot',ARRAY['leaderboard','staffHome']::text[],'market'),
('Club',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('ClubYearGroupBand',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('ClubSignup',ARRAY['club','rota','attendance','staffHome','student','behaviour','studentSettings']::text[],'club'),
('ClubNotification',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('ClubAttendance',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('ClubLeadAssignment',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('ClubRotaParticipant',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('ClubRotaShift',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('ClubAvailabilityWindow',ARRAY['club','rota','attendance','staffHome']::text[],'club'),
('FaithCornerContent',ARRAY['faithCorner','staffHome','student']::text[],'faith'),
('FaithCornerContentLike',ARRAY['faithCorner','staffHome','student']::text[],'faith'),
('FaithCornerComment',ARRAY['faithCorner','staffHome','student']::text[],'faith'),
('FaithCornerCommentLike',ARRAY['faithCorner','staffHome']::text[],'faith'),
('StaffNotice',ARRAY['notice','staffHome']::text[],'staff'),
('StaffNoticeAttachment',ARRAY['notice','staffHome']::text[],'staff'),
('StaffNoticeRead',ARRAY['notice','staffHome']::text[],'staff'),
('CalendarEvent',ARRAY['calendar','staffHome','childLog','rota','personalTask','timetable']::text[],'calendar'),
('CalendarEventRequiredPerson',ARRAY['calendar','staffHome']::text[],'calendar'),
('UserAgreement',ARRAY['userAgreement','compliance','staffHome']::text[],'agreement'),
('UserAgreementVersion',ARRAY['userAgreement','compliance','staffHome']::text[],'agreement'),
('UserAgreementRequest',ARRAY['userAgreement','compliance','staffHome']::text[],'agreement'),
('UserAgreementSignature',ARRAY['userAgreement','compliance','staffHome']::text[],'agreement'),
('PermissionSlip',ARRAY['permissionSlip','calendar','staffHome']::text[],'permission'),
('PermissionSlipRecipient',ARRAY['permissionSlip','calendar','staffHome']::text[],'permission'),
('PermissionSlipBringItem',ARRAY['permissionSlip','calendar','staffHome']::text[],'permission'),
('PermissionSlipQuestion',ARRAY['permissionSlip','calendar','staffHome']::text[],'permission'),
('PermissionSlipAnswer',ARRAY['permissionSlip','calendar','staffHome']::text[],'permission'),
('IncidentReport',ARRAY['incident','compliance','staffHome']::text[],'incident'),
('IncidentReportStudent',ARRAY['incident','compliance','staffHome']::text[],'incident'),
('IncidentReportStaff',ARRAY['incident','compliance','staffHome']::text[],'incident'),
('IncidentReportAttachment',ARRAY['incident','compliance','staffHome']::text[],'incident'),
('IncidentReportParentCopy',ARRAY['incident','compliance','staffHome']::text[],'incident'),
('IncidentReportParentRecipient',ARRAY['incident','compliance','staffHome']::text[],'incident'),
('IncidentReportEvent',ARRAY['incident','compliance','staffHome']::text[],'incident'),
('IncidentSafeguardingNote',ARRAY['incident','compliance']::text[],'safeguarding'),
('MessageThread',ARRAY['message','staffHome']::text[],'message'),
('MessageThreadParticipant',ARRAY['message','staffHome']::text[],'message'),
('Message',ARRAY['message','staffHome']::text[],'message'),
('MessageRead',ARRAY['message','staffHome']::text[],'message'),
('CommunityGroup',ARRAY['community','staffHome']::text[],'community'),
('CommunityGroupMember',ARRAY['community','staffHome']::text[],'community'),
('CommunityMessage',ARRAY['community','staffHome']::text[],'community'),
('CommunityMessageRead',ARRAY['community','staffHome']::text[],'community'),
('TermReport',ARRAY['report','staffHome']::text[],'student'),
('SchoolFeeYearFeeConfig',ARRAY['invoice','staffHome']::text[],'finance'),
('SchoolFeeInvoice',ARRAY['invoice','staffHome']::text[],'finance'),
('SchoolFeeInvoiceLineItem',ARRAY['invoice','staffHome']::text[],'finance'),
('SchoolFeeInvoiceStudent',ARRAY['invoice','staffHome']::text[],'finance'),
('SchoolFeeInvoiceDiscount',ARRAY['invoice','staffHome']::text[],'finance');

CREATE TABLE oasis_private.pending_change (
  transaction_id bigint NOT NULL, clerk_id text NOT NULL, area text NOT NULL,
  PRIMARY KEY (transaction_id, clerk_id, area)
);
ALTER TABLE oasis_private.pending_change ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA oasis_private FROM PUBLIC;

CREATE FUNCTION oasis_private.capture_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, oasis_private
AS $$
DECLARE data jsonb; coverage oasis_private.model_coverage; recipient record; area text;
BEGIN
  SELECT * INTO coverage FROM oasis_private.model_coverage WHERE model = TG_TABLE_NAME;
  IF cardinality(coverage.areas) = 0 THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'updatedAt') = (to_jsonb(NEW) - 'updatedAt') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'StudentPortalUsageMinute' AND TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'AuditLog' AND (coalesce(to_jsonb(NEW)->>'action',to_jsonb(OLD)->>'action') NOT IN ('Create','Update','Delete','PermissionDenied')
    OR coalesce(to_jsonb(NEW)->>'entity',to_jsonb(OLD)->>'entity') NOT IN ('Attendance','AttendanceExport','BehaviourEntry','ChildNote','PaceAdvancementApproval','PaceRecord','StaffAttendance','Student','StudentSubject','User')) THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_TABLE_NAME = 'UserAgreementDelivery' AND TG_OP = 'UPDATE'
    AND (to_jsonb(OLD) - ARRAY['claimUntil','nextAttemptAt']) = (to_jsonb(NEW) - ARRAY['claimUntil','nextAttemptAt']) THEN RETURN NEW; END IF;
  IF TG_WHEN = 'BEFORE' THEN
    IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
    data := to_jsonb(OLD);
  ELSE data := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME = 'User' AND (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    -- Account control must reach the old connection even after it is deactivated.
    INSERT INTO oasis_private.pending_change VALUES (txid_current(),data->>'clerkId','profile') ON CONFLICT DO NOTHING;
  END IF;
  FOR recipient IN SELECT r.clerk_id,u.id FROM oasis_private.recipients(TG_TABLE_NAME,coverage.audience,data) r
    JOIN public."User" u ON u."clerkId" = r.clerk_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM unnest(coverage.areas) expected(area) WHERE NOT EXISTS (
      SELECT 1 FROM oasis_private.pending_change p WHERE p.transaction_id = txid_current() AND p.clerk_id = recipient.clerk_id AND p.area = expected.area)) THEN CONTINUE; END IF;
    -- Usage and delivery status are API-authorized projections; their explicit
    -- audiences do not grant access to the underlying bookkeeping rows.
    IF TG_TABLE_NAME NOT IN ('StudentPortalUsageMinute','UserAgreementDelivery') AND NOT oasis_private.row_visible(TG_TABLE_NAME,data,recipient.id) THEN CONTINUE; END IF;
    FOREACH area IN ARRAY coverage.areas LOOP
      INSERT INTO oasis_private.pending_change VALUES (txid_current(),recipient.clerk_id,area) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  RETURN coalesce(NEW,OLD);
END;
$$;

CREATE FUNCTION oasis_private.flush_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, oasis_private
AS $$
DECLARE recipient record;
BEGIN
  FOR recipient IN
    SELECT p.clerk_id,array_agg(DISTINCT p.area ORDER BY p.area) AS areas
    FROM oasis_private.pending_change p
    WHERE p.transaction_id = txid_current()
      -- Domain events check current active authority at send time. The profile-only
      -- purge exception is needed for revoked/deleted users on existing channels.
      AND (p.area = 'profile' OR EXISTS (SELECT 1 FROM public."User" u WHERE u."clerkId" = p.clerk_id AND u.active AND u."deletedAt" IS NULL))
    GROUP BY p.clerk_id
  LOOP
    IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
      PERFORM realtime.send(jsonb_build_object('eventId',gen_random_uuid()::text,
        'areas',to_jsonb(recipient.areas),'occurredAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
        'oasis.data_changed','oasis:user:' || recipient.clerk_id,true);
    END IF;
  END LOOP;
  DELETE FROM oasis_private.pending_change WHERE transaction_id = txid_current();
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER oasis_flush_changes AFTER INSERT ON oasis_private.pending_change
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION oasis_private.flush_changes();

DO $$
DECLARE coverage record;
BEGIN
  FOR coverage IN SELECT * FROM oasis_private.model_coverage WHERE cardinality(areas) > 0 LOOP
    EXECUTE format('CREATE TRIGGER oasis_capture_before BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION oasis_private.capture_change()',coverage.model);
    EXECUTE format('CREATE TRIGGER oasis_capture_after AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION oasis_private.capture_change()',coverage.model);
  END LOOP;
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA oasis_private FROM PUBLIC;

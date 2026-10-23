-- Resolve nested records while OLD relationships still exist (BEFORE DELETE).
CREATE FUNCTION oasis_private.change_context(model text, row_data jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, oasis_private
AS $$
DECLARE result jsonb := row_data; linked jsonb; key text;
BEGIN
  IF model = 'Student' THEN result := result || jsonb_build_object('studentId', row_data->>'id'); END IF;
  IF model = 'User' THEN result := result || jsonb_build_object('userId', row_data->>'id'); END IF;
  FOR key IN SELECT unnest(ARRAY['assignmentId','submissionId','planId','timetableId','publicationId',
    'reservationId','invoiceId','registrationId','profileId','noticeId','reportId','copyId',
    'requestId','versionId','agreementId','messageId','threadId','groupId','commentId'])
  LOOP
    IF result->>key IS NULL THEN CONTINUE; END IF;
    linked := NULL;
    CASE key
      WHEN 'assignmentId' THEN SELECT to_jsonb(t) INTO linked FROM public."HomeworkAssignment" t WHERE t.id = result->>key;
      WHEN 'submissionId' THEN SELECT to_jsonb(t) INTO linked FROM public."HomeworkSubmission" t WHERE t.id = result->>key;
      WHEN 'planId' THEN SELECT to_jsonb(t) INTO linked FROM public."PaceGapPlan" t WHERE t.id = result->>key;
      WHEN 'timetableId' THEN SELECT to_jsonb(t) INTO linked FROM public."StudentTimetable" t WHERE t.id = result->>key;
      WHEN 'publicationId' THEN SELECT to_jsonb(t) INTO linked FROM public."StudentTimetablePublication" t WHERE t.id = result->>key;
      WHEN 'reservationId' THEN SELECT to_jsonb(t) INTO linked FROM public."ShopReservation" t WHERE t.id = result->>key;
      WHEN 'invoiceId' THEN SELECT to_jsonb(t) INTO linked FROM public."SchoolFeeInvoice" t WHERE t.id = result->>key;
      WHEN 'registrationId' THEN SELECT to_jsonb(t) INTO linked FROM public."ParentRegistration" t WHERE t.id = result->>key;
      WHEN 'profileId' THEN SELECT to_jsonb(t) INTO linked FROM public."StudentRegistrationProfile" t WHERE t.id = result->>key;
      WHEN 'noticeId' THEN SELECT to_jsonb(t) INTO linked FROM public."StaffNotice" t WHERE t.id = result->>key;
      WHEN 'reportId' THEN SELECT to_jsonb(t) INTO linked FROM public."IncidentReport" t WHERE t.id = result->>key;
      WHEN 'copyId' THEN SELECT to_jsonb(t) INTO linked FROM public."IncidentReportParentCopy" t WHERE t.id = result->>key;
      WHEN 'requestId' THEN SELECT to_jsonb(t) INTO linked FROM public."UserAgreementRequest" t WHERE t.id = result->>key;
      WHEN 'versionId' THEN SELECT to_jsonb(t) INTO linked FROM public."UserAgreementVersion" t WHERE t.id = result->>key;
      WHEN 'agreementId' THEN SELECT to_jsonb(t) INTO linked FROM public."UserAgreement" t WHERE t.id = result->>key;
      WHEN 'messageId' THEN
        IF model LIKE 'Community%' THEN SELECT to_jsonb(t) INTO linked FROM public."CommunityMessage" t WHERE t.id = result->>key;
        ELSE SELECT to_jsonb(t) INTO linked FROM public."Message" t WHERE t.id = result->>key; END IF;
      WHEN 'threadId' THEN SELECT to_jsonb(t) INTO linked FROM public."MessageThread" t WHERE t.id = result->>key;
      WHEN 'groupId' THEN SELECT to_jsonb(t) INTO linked FROM public."CommunityGroup" t WHERE t.id = result->>key;
      WHEN 'commentId' THEN SELECT to_jsonb(t) INTO linked FROM public."FaithCornerComment" t WHERE t.id = result->>key;
      ELSE NULL;
    END CASE;
    -- Child fields take precedence; only inherit relationship keys, never expose row_data.
    IF linked IS NOT NULL THEN result := linked || result; END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE FUNCTION oasis_private.recipients(model text, audience text, row_data jsonb)
RETURNS TABLE (clerk_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, oasis_private
AS $$
DECLARE data jsonb := oasis_private.change_context(model, row_data);
BEGIN
  RETURN QUERY
  SELECT DISTINCT u."clerkId" FROM public."User" u
  WHERE u.active AND u."deletedAt" IS NULL AND (
    -- Identity changes invalidate the affected connection even when rights are removed.
    (audience = 'audit' AND (u.role = 'Head' OR (u.role NOT IN ('Parent','Student','ClubsLead','SafeguardingLead') AND 'audit-viewer' = ANY(u.tags))))
    OR (audience = 'usage' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport')
      OR EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."userId" = u.id AND g."studentId" = data->>'studentId')))
    OR (audience = 'identity' AND (u.id = data->>'userId'
      OR u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport')
      OR EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."studentId" = data->>'studentId' AND g."userId" = u.id)))
    OR (audience = 'own' AND u.id = data->>'ownerId')
    OR (audience = 'agreement' AND (u.role = 'Head'
      OR u.id = data->>'recipientId'
      OR EXISTS (SELECT 1 FROM public."UserAgreementRequest" r
        JOIN public."UserAgreementVersion" v ON v.id = r."versionId"
        WHERE r."recipientId" = u.id AND (r.id = data->>'requestId'
          OR v.id = data->>'versionId' OR v."agreementId" = coalesce(data->>'agreementId', CASE WHEN model = 'UserAgreement' THEN data->>'id' END)))))
    OR (audience = 'message' AND (u.id IN (data->>'parentId',data->>'supervisorId',data->>'adminId',data->>'userId')
      OR EXISTS (SELECT 1 FROM public."MessageThreadParticipant" p WHERE p."userId" = u.id
        AND p."threadId" = coalesce(data->>'threadId', CASE WHEN model = 'MessageThread' THEN data->>'id' END))))
    OR (audience = 'safeguarding' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','SafeguardingLead')
      OR (u.role NOT IN ('Parent','Student') AND 'compliance-admin' = ANY(u.tags))))
    OR (audience = 'incident' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','SafeguardingLead','Supervisor')
      OR (u.role NOT IN ('Parent','Student') AND 'compliance-admin' = ANY(u.tags))
      OR (model IN ('IncidentReportParentCopy','IncidentReportParentRecipient') AND data->>'status' = 'Shared'
        AND EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."userId" = u.id AND g."studentId" = data->>'studentId'))))
    OR (audience = 'compliance' AND u.role NOT IN ('Parent','Student'))
    OR (audience = 'library' AND ((u.role NOT IN ('Parent','Student','SafeguardingLead') AND 'librarian' = ANY(u.tags))
      OR EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."userId" = u.id)))
    OR (audience = 'registration' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport')
      OR u.id IN (data->>'parentUserId',data->>'targetUserId',data->>'acceptedUserId',data->>'guardianLinkInviterId')))
    OR (audience = 'permission' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport','Supervisor','ClubsAdmin')
      OR EXISTS (SELECT 1 FROM public."PermissionSlipRecipient" r JOIN public."Guardian" g ON g."studentId" = r."studentId"
        WHERE g."userId" = u.id AND r."slipId" = coalesce(data->>'slipId',data->>'id'))
      OR EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."userId" = u.id AND g."studentId" = data->>'studentId')))
    OR (audience = 'finance' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline') OR 'finance-admin' = ANY(u.tags)
      OR (model = 'SchoolFeeYearFeeConfig' AND u.role IN ('Parent','Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport','ClubsAdmin','Supervisor')
        AND EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."userId" = u.id))
      OR EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."userId" = u.id AND (g."studentId" = data->>'studentId'
        OR EXISTS (SELECT 1 FROM public."SchoolFeeInvoiceStudent" l WHERE l."studentId" = g."studentId" AND l."invoiceId" = coalesce(data->>'invoiceId',data->>'id'))))))
    OR (audience = 'community' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport')
      OR EXISTS (SELECT 1 FROM public."Student" s JOIN public."CommunityGroupMember" m ON m."studentId" = s.id
        WHERE s."userId" = u.id AND m.active AND m."groupId" = coalesce(data->>'groupId',data->>'id'))
      OR (model = 'CommunityGroupMember' AND EXISTS (SELECT 1 FROM public."Student" s WHERE s.id = data->>'studentId' AND s."userId" = u.id))))
    OR (audience = 'staff' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport','ClubsAdmin','Supervisor')
      OR u.id IN (data->>'staffUserId',data->>'parentUserId',data->>'userId',data->>'participantUserId',data->>'requesterUserId',data->>'targetUserId')))
    OR (audience = 'calendar' AND (data->>'audience' = 'All'
      OR (u.role = 'Parent' AND data->>'audience' = 'Parents')
      OR u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport')
      OR (u.role IN ('Supervisor','ClubsAdmin') AND data->>'audience' = 'Supervisors')
      OR u.id = data->>'userId'
      OR (u.role IN ('Supervisor','ClubsAdmin') AND EXISTS (SELECT 1 FROM public."CalendarEventRequiredPerson" p
        WHERE p."userId" = u.id AND p."eventId" = coalesce(data->>'eventId', CASE WHEN model = 'CalendarEvent' THEN data->>'id' END)))))
    OR (audience = 'market' AND u.role <> 'SafeguardingLead')
    OR (audience = 'faith' AND (u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','Student')))
    OR (audience IN ('student','pace','homework','timetable','behaviour','notes','club') AND (
      u.role IN ('Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport')
      OR (audience = 'notes' AND (u.role IN ('ClubsAdmin','Supervisor') AND (coalesce((data->>'sensitive')::boolean,false) = false OR 'sensitive-note-viewer' = ANY(u.tags))))
      OR (audience <> 'notes' AND u.role IN ('Supervisor','ClubsAdmin') AND (
        data->>'studentId' IS NULL OR 'supervisor-all-students' = ANY(u.tags)
        OR EXISTS (SELECT 1 FROM public."StaffShift" sh JOIN public."Student" s ON s."ageBandId" = sh."yearGroupBandId"
          WHERE sh."staffUserId" = u.id AND s.id = data->>'studentId' AND sh.date = (now() AT TIME ZONE 'Europe/London')::date)))
      OR (audience = 'pace' AND 'pace-full-access' = ANY(u.tags))
      OR (audience = 'pace' AND model IN ('Subject','PacePolicy') AND (
        (u.role = 'Student' AND EXISTS (SELECT 1 FROM public."Student" s WHERE s."userId" = u.id AND s.active))
        OR (u.role IN ('Parent','Head','Principal','Pastor','HeadOfDiscipline','TechnicalSupport','ClubsAdmin','Supervisor')
          AND EXISTS (SELECT 1 FROM public."Guardian" g JOIN public."Student" s ON s.id = g."studentId" WHERE g."userId" = u.id AND s.active))))
      OR (audience <> 'notes' AND EXISTS (SELECT 1 FROM public."Guardian" g WHERE g."userId" = u.id AND g."studentId" = data->>'studentId'))
      OR (audience <> 'notes' AND EXISTS (SELECT 1 FROM public."Student" s WHERE s."userId" = u.id AND s.id = data->>'studentId'))
      OR (audience IN ('club','behaviour') AND EXISTS (SELECT 1 FROM public."ClubLeadAssignment" a
        WHERE a."userId" = u.id AND a."clubId" = coalesce(data->>'clubId',CASE WHEN model = 'Club' THEN data->>'id' END)))
      OR (data->>'studentId' IS NULL AND audience IN ('homework','timetable','club') AND u.role IN ('Parent','Student'))
    ))
  );
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA oasis_private FROM PUBLIC;

-- API guards above narrow recipients. Existing row policies further restrict sensitive
-- records; they are evaluated on OLD too, so deleting a row still invalidates readers.
CREATE FUNCTION oasis_private.row_visible(model text, row_data jsonb, target_user text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, oasis_private
AS $$
DECLARE
  table_oid regclass := to_regclass(format('public.%I', model));
  permissive text; restrictive text; allowed boolean; recipient public."User";
  saved_user text := current_setting('app.user_id',true);
  saved_role text := current_setting('app.user_role',true);
  saved_admin text := current_setting('app.full_admin',true);
  saved_compliance text := current_setting('app.compliance_admin',true);
  saved_worker text := current_setting('app.agreement_delivery_worker',true);
  saved_gap_read text := current_setting('app.pace_gap_read_student_id',true);
  saved_gap_write text := current_setting('app.pace_gap_write_student_id',true);
  gap_student text := CASE WHEN model IN ('PaceGapPlan','PaceGapPlanItem')
    THEN oasis_private.change_context(model,row_data)->>'studentId' ELSE NULL END;
BEGIN
  SELECT string_agg('(' || pg_get_expr(polqual,polrelid) || ')',' OR ') FILTER (WHERE polpermissive),
    string_agg('(' || pg_get_expr(polqual,polrelid) || ')',' AND ') FILTER (WHERE NOT polpermissive)
  INTO permissive, restrictive FROM pg_policy WHERE polrelid = table_oid AND polcmd IN ('r','*');
  IF permissive IS NULL THEN
    -- Models without RLS use only their explicit API-guard-backed audience above.
    RETURN NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = table_oid AND relrowsecurity);
  END IF;
  SELECT * INTO recipient FROM public."User" WHERE id = target_user;
  PERFORM set_config('app.user_id',recipient.id,true);
  PERFORM set_config('app.user_role',recipient.role::text,true);
  PERFORM set_config('app.full_admin',(recipient.role IN ('Head','Principal','Pastor','HeadOfDiscipline'))::text,true);
  PERFORM set_config('app.compliance_admin',(recipient.role NOT IN ('Parent','Student') AND 'compliance-admin' = ANY(recipient.tags))::text,true);
  PERFORM set_config('app.agreement_delivery_worker','false',true);
  -- capture_change already checked the API audience; scoped gap-plan SELECTs
  -- additionally require the same student scope established by PACE readers.
  PERFORM set_config('app.pace_gap_read_student_id',coalesce(gap_student,''),true);
  PERFORM set_config('app.pace_gap_write_student_id','',true);
  EXECUTE format('SELECT (%s) AND (%s) FROM jsonb_populate_record(NULL::public.%I,$1) AS %I',
    permissive,coalesce(restrictive,'true'),model,model) INTO allowed USING row_data;
  PERFORM set_config('app.user_id',coalesce(saved_user,''),true);
  PERFORM set_config('app.user_role',coalesce(saved_role,''),true);
  PERFORM set_config('app.full_admin',coalesce(saved_admin,''),true);
  PERFORM set_config('app.compliance_admin',coalesce(saved_compliance,''),true);
  PERFORM set_config('app.agreement_delivery_worker',coalesce(saved_worker,''),true);
  PERFORM set_config('app.pace_gap_read_student_id',coalesce(saved_gap_read,''),true);
  PERFORM set_config('app.pace_gap_write_student_id',coalesce(saved_gap_write,''),true);
  RETURN coalesce(allowed,false);
END;
$$;
REVOKE ALL ON FUNCTION oasis_private.row_visible(text,jsonb,text) FROM PUBLIC;

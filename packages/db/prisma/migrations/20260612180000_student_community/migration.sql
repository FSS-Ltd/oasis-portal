-- Student community messaging: text-only group chat with staff moderation.

ALTER TABLE public."StudentPortalSettings"
  ADD COLUMN "communityMessagingBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "communityMessagingBlockedReasonEnc" TEXT,
  ADD COLUMN "communityMessagingBlockedById" TEXT,
  ADD COLUMN "communityMessagingBlockedAt" TIMESTAMP(3);

CREATE TABLE public."CommunityGroup" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "descriptionEnc" TEXT,
  "isCentral" BOOLEAN NOT NULL DEFAULT FALSE,
  "isPublic" BOOLEAN NOT NULL DEFAULT TRUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public."CommunityGroupMember" (
  "groupId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3),

  CONSTRAINT "CommunityGroupMember_pkey" PRIMARY KEY ("groupId", "studentId")
);

CREATE TABLE public."CommunityMessage" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "senderStudentId" TEXT NOT NULL,
  "bodyEnc" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public."CommunityMessageRead" (
  "messageId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityMessageRead_pkey" PRIMARY KEY ("messageId", "studentId")
);

CREATE UNIQUE INDEX "CommunityGroup_one_central_idx"
  ON public."CommunityGroup" ("isCentral")
  WHERE "isCentral" = TRUE;

CREATE INDEX "StudentPortalSettings_communityMessagingBlockedById_communityMessagingBlockedAt_idx"
  ON public."StudentPortalSettings" ("communityMessagingBlockedById", "communityMessagingBlockedAt");

CREATE INDEX "CommunityGroup_active_isCentral_idx"
  ON public."CommunityGroup" ("active", "isCentral");
CREATE INDEX "CommunityGroup_updatedAt_idx"
  ON public."CommunityGroup" ("updatedAt");
CREATE INDEX "CommunityGroup_createdById_createdAt_idx"
  ON public."CommunityGroup" ("createdById", "createdAt");
CREATE INDEX "CommunityGroup_updatedById_updatedAt_idx"
  ON public."CommunityGroup" ("updatedById", "updatedAt");

CREATE INDEX "CommunityGroupMember_studentId_active_idx"
  ON public."CommunityGroupMember" ("studentId", "active");
CREATE INDEX "CommunityGroupMember_groupId_active_idx"
  ON public."CommunityGroupMember" ("groupId", "active");
CREATE INDEX "CommunityGroupMember_updatedById_updatedAt_idx"
  ON public."CommunityGroupMember" ("updatedById", "updatedAt");

CREATE INDEX "CommunityMessage_groupId_createdAt_idx"
  ON public."CommunityMessage" ("groupId", "createdAt");
CREATE INDEX "CommunityMessage_senderStudentId_createdAt_idx"
  ON public."CommunityMessage" ("senderStudentId", "createdAt");
CREATE INDEX "CommunityMessage_deletedById_deletedAt_idx"
  ON public."CommunityMessage" ("deletedById", "deletedAt");

CREATE INDEX "CommunityMessageRead_studentId_readAt_idx"
  ON public."CommunityMessageRead" ("studentId", "readAt");

ALTER TABLE public."StudentPortalSettings"
  ADD CONSTRAINT "StudentPortalSettings_communityMessagingBlockedById_fkey"
  FOREIGN KEY ("communityMessagingBlockedById") REFERENCES public."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."CommunityGroup"
  ADD CONSTRAINT "CommunityGroup_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES public."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunityGroup_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES public."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."CommunityGroupMember"
  ADD CONSTRAINT "CommunityGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES public."CommunityGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunityGroupMember_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES public."Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunityGroupMember_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES public."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."CommunityMessage"
  ADD CONSTRAINT "CommunityMessage_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES public."CommunityGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunityMessage_senderStudentId_fkey"
  FOREIGN KEY ("senderStudentId") REFERENCES public."Student"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunityMessage_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES public."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."CommunityMessageRead"
  ADD CONSTRAINT "CommunityMessageRead_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES public."CommunityMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunityMessageRead_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES public."Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.oasis_realtime_community_group_payload(
  group_id TEXT,
  operation_name TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'groupId', group_id,
    'operation', operation_name,
    'occurredAt', timezone('utc', now())::TEXT
  );
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_broadcast_community_admins(
  event_name TEXT,
  event_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient RECORD;
BEGIN
  FOR recipient IN
    SELECT DISTINCT u."clerkId"
    FROM public."User" u
    WHERE u.active = TRUE
      AND u.role IN ('Head', 'Principal', 'Pastor', 'HeadOfDiscipline')
  LOOP
    PERFORM public.oasis_realtime_broadcast_user(recipient."clerkId", event_name, event_payload);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_broadcast_community_group(
  group_id TEXT,
  event_name TEXT,
  operation_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  recipient RECORD;
BEGIN
  IF group_id IS NULL THEN
    RETURN;
  END IF;

  payload := public.oasis_realtime_community_group_payload(group_id, operation_name);

  FOR recipient IN
    SELECT DISTINCT u."clerkId"
    FROM public."CommunityGroupMember" cgm
    JOIN public."Student" s ON s.id = cgm."studentId"
    JOIN public."User" u ON u.id = s."userId"
    WHERE cgm."groupId" = group_id
      AND cgm.active = TRUE
      AND s.active = TRUE
      AND u.active = TRUE
  LOOP
    PERFORM public.oasis_realtime_broadcast_user(recipient."clerkId", event_name, payload);
  END LOOP;

  PERFORM public.oasis_realtime_broadcast_community_admins(event_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_community_group_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.oasis_realtime_broadcast_community_group(
    COALESCE(NEW.id, OLD.id),
    'oasis.community_group_changed',
    TG_OP
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_community_member_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.oasis_realtime_broadcast_community_group(
    COALESCE(NEW."groupId", OLD."groupId"),
    'oasis.community_member_changed',
    TG_OP
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_community_message_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.oasis_realtime_broadcast_community_group(
    NEW."groupId",
    'oasis.community_message_changed',
    TG_OP
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_community_read_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_group_id TEXT;
BEGIN
  SELECT cm."groupId"
  INTO message_group_id
  FROM public."CommunityMessage" cm
  WHERE cm.id = NEW."messageId";

  PERFORM public.oasis_realtime_broadcast_community_group(
    message_group_id,
    'oasis.community_read_changed',
    TG_OP
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS oasis_realtime_community_group_changed ON public."CommunityGroup";
CREATE TRIGGER oasis_realtime_community_group_changed
AFTER INSERT OR UPDATE ON public."CommunityGroup"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_community_group_changed();

DROP TRIGGER IF EXISTS oasis_realtime_community_member_changed ON public."CommunityGroupMember";
CREATE TRIGGER oasis_realtime_community_member_changed
AFTER INSERT OR UPDATE OR DELETE ON public."CommunityGroupMember"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_community_member_changed();

DROP TRIGGER IF EXISTS oasis_realtime_community_message_changed ON public."CommunityMessage";
CREATE TRIGGER oasis_realtime_community_message_changed
AFTER INSERT OR UPDATE ON public."CommunityMessage"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_community_message_changed();

DROP TRIGGER IF EXISTS oasis_realtime_community_read_changed ON public."CommunityMessageRead";
CREATE TRIGGER oasis_realtime_community_read_changed
AFTER INSERT ON public."CommunityMessageRead"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_community_read_changed();

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RETURN;
  END IF;

  IF to_regprocedure('realtime.topic()') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS oasis_community_realtime_receive ON realtime.messages';
  EXECUTE $policy$
    CREATE POLICY oasis_community_realtime_receive
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      realtime.messages.extension = 'broadcast'
      AND realtime.topic() LIKE 'oasis:community:%'
      AND EXISTS (
        SELECT 1
        FROM public."CommunityGroupMember" cgm
        JOIN public."Student" s ON s.id = cgm."studentId"
        JOIN public."User" u ON u.id = s."userId"
        WHERE cgm."groupId" = substring(realtime.topic() from 17)
          AND cgm.active = TRUE
          AND s.active = TRUE
          AND u.active = TRUE
          AND u."clerkId" = (auth.jwt() ->> 'sub')
      )
    )
  $policy$;
END;
$$;

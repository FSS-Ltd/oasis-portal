-- Supabase Realtime is used as a private invalidation bus. Application reads
-- remain behind tRPC/Prisma so RBAC, audit logging, and decryption stay server-side.

CREATE OR REPLACE FUNCTION public.oasis_realtime_broadcast_user(
  target_clerk_id TEXT,
  event_name TEXT,
  event_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_clerk_id IS NULL OR target_clerk_id = '' THEN
    RETURN;
  END IF;

  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM realtime.send(
    event_payload,
    event_name,
    'oasis:user:' || target_clerk_id,
    TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_message_thread_payload(
  thread_id TEXT,
  operation_name TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'threadId', thread_id,
    'operation', operation_name,
    'occurredAt', timezone('utc', now())::TEXT
  );
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_broadcast_thread(
  thread_id TEXT,
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
  IF thread_id IS NULL THEN
    RETURN;
  END IF;

  payload := public.oasis_realtime_message_thread_payload(thread_id, operation_name);

  FOR recipient IN
    SELECT DISTINCT u."clerkId"
    FROM public."MessageThreadParticipant" mtp
    JOIN public."User" u ON u.id = mtp."userId"
    WHERE mtp."threadId" = thread_id
      AND u.active = TRUE
  LOOP
    PERFORM public.oasis_realtime_broadcast_user(recipient."clerkId", event_name, payload);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_message_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.oasis_realtime_broadcast_thread(
    NEW."threadId",
    'oasis.message_changed',
    TG_OP
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_message_read_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_thread_id TEXT;
BEGIN
  SELECT m."threadId"
  INTO message_thread_id
  FROM public."Message" m
  WHERE m.id = NEW."messageId";

  PERFORM public.oasis_realtime_broadcast_thread(
    message_thread_id,
    'oasis.message_read_changed',
    TG_OP
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_message_thread_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.oasis_realtime_broadcast_thread(
    COALESCE(NEW.id, OLD.id),
    'oasis.message_thread_changed',
    TG_OP
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_message_thread_participant_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_clerk_id TEXT;
BEGIN
  SELECT u."clerkId"
  INTO user_clerk_id
  FROM public."User" u
  WHERE u.id = COALESCE(NEW."userId", OLD."userId")
    AND u.active = TRUE;

  PERFORM public.oasis_realtime_broadcast_user(
    user_clerk_id,
    'oasis.message_thread_changed',
    public.oasis_realtime_message_thread_payload(COALESCE(NEW."threadId", OLD."threadId"), TG_OP)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.oasis_realtime_child_note_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient RECORD;
  payload JSONB;
BEGIN
  payload := jsonb_build_object(
    'operation', TG_OP,
    'occurredAt', timezone('utc', now())::TEXT
  );

  FOR recipient IN
    SELECT DISTINCT u."clerkId"
    FROM public."User" u
    WHERE u.active = TRUE
      AND u.role IN (
        'Head',
        'Principal',
        'Pastor',
        'HeadOfDiscipline',
        'TechnicalSupport',
        'ClubsAdmin',
        'Supervisor'
      )
  LOOP
    PERFORM public.oasis_realtime_broadcast_user(
      recipient."clerkId",
      'oasis.child_notes_changed',
      payload
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS oasis_realtime_message_changed ON public."Message";
CREATE TRIGGER oasis_realtime_message_changed
AFTER INSERT ON public."Message"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_message_changed();

DROP TRIGGER IF EXISTS oasis_realtime_message_read_changed ON public."MessageRead";
CREATE TRIGGER oasis_realtime_message_read_changed
AFTER INSERT ON public."MessageRead"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_message_read_changed();

DROP TRIGGER IF EXISTS oasis_realtime_message_thread_changed ON public."MessageThread";
CREATE TRIGGER oasis_realtime_message_thread_changed
AFTER INSERT ON public."MessageThread"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_message_thread_changed();

DROP TRIGGER IF EXISTS oasis_realtime_message_thread_participant_changed ON public."MessageThreadParticipant";
CREATE TRIGGER oasis_realtime_message_thread_participant_changed
AFTER INSERT OR DELETE ON public."MessageThreadParticipant"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_message_thread_participant_changed();

DROP TRIGGER IF EXISTS oasis_realtime_child_note_changed ON public."ChildNote";
CREATE TRIGGER oasis_realtime_child_note_changed
AFTER INSERT OR UPDATE ON public."ChildNote"
FOR EACH ROW
EXECUTE FUNCTION public.oasis_realtime_child_note_changed();

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RETURN;
  END IF;

  IF to_regprocedure('realtime.topic()') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS oasis_user_realtime_receive ON realtime.messages';
  EXECUTE $policy$
    CREATE POLICY oasis_user_realtime_receive
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      realtime.messages.extension = 'broadcast'
      AND realtime.topic() = ('oasis:user:' || (auth.jwt() ->> 'sub'))
    )
  $policy$;
END;
$$;

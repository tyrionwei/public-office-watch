CREATE FUNCTION reject_hidden_chat_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.reply_to_message_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM chat_messages replied
        JOIN chat_profiles replied_author ON replied_author.user_id = replied.user_id
        WHERE replied.id = NEW.reply_to_message_id
          AND (
              replied.moderation_status <> 'visible'
              OR replied_author.status = 'banned'
              OR (
                  replied_author.status = 'muted'
                  AND (
                      replied_author.muted_until IS NULL
                      OR replied_author.muted_until > NOW()
                  )
              )
          )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHAT_REPLY_UNAVAILABLE';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER chat_messages_reject_hidden_reply
BEFORE INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION reject_hidden_chat_reply();

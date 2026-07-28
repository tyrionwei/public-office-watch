ALTER TABLE chat_moderation_actions
DROP CONSTRAINT chat_moderation_actions_action_type_check;

ALTER TABLE chat_moderation_actions
ADD CONSTRAINT chat_moderation_actions_action_type_check CHECK (
    action_type IN (
        'chat_enabled',
        'chat_disabled',
        'message_removed',
        'message_restored',
        'user_muted',
        'user_banned',
        'user_unmuted',
        'security_hold_applied',
        'security_hold_released'
    )
);

-- Throttle new-message email notifications to at most one per recipient per chat
-- per 30 minutes. We record when each side was last notified; the notify-message
-- route checks these before sending. Two columns (one per role) because a chat
-- has exactly one seeker and one lister.
alter table chats
  add column if not exists seeker_notified_at timestamptz,
  add column if not exists lister_notified_at timestamptz;

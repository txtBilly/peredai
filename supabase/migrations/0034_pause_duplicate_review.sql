-- Pause duplicate-account detection during the preview. Testers verify with the
-- same mock identity / reuse names + phones, which the flag_duplicate_profile
-- trigger (0025/0026) correctly flags as duplicates — but that blocks testing.
-- This disables the trigger (reversible) and clears existing flags so flagged
-- accounts can publish again.
--
-- To re-enable when going public with real, distinct identities:
--   alter table profiles enable trigger trg_flag_duplicate_profile;
alter table profiles disable trigger trg_flag_duplicate_profile;

update profiles
set duplicate_review = false,
    duplicate_reason = null,
    duplicate_matched_id = null
where duplicate_review is true;

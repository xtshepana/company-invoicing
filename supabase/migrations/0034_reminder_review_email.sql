-- Safety gate: instead of emailing clients directly, payment reminder
-- checkpoints (30th/5th/10th) email one digest listing everyone in
-- arrears (with account numbers) to this address, so a human reviews and
-- decides who actually gets reminded. Nullable - reminders are simply
-- skipped (not an error, not a fallback to emailing clients directly) if
-- this isn't configured.
alter table public.company_settings add column reminder_review_email text;

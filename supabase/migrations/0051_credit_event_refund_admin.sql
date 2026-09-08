-- Ensure the credit_event enum has 'refund_admin' (used by the admin
-- "void tokens" action after a money refund). Idempotent: a no-op if the value
-- already exists (it's declared in schema.sql, so most environments have it).
-- Must run outside a transaction block / as its own statement.
alter type credit_event add value if not exists 'refund_admin';

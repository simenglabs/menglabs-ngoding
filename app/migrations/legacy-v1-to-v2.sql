-- One-time additive upgrade for databases created before versioned Drizzle migrations.
-- Take a backup first. Do not run this after drizzle/0000_wealthy_firestar.sql.
CREATE INDEX IF NOT EXISTS session_user_idx ON session (user_id);
CREATE INDEX IF NOT EXISTS session_expiry_idx ON session (expires_at);
CREATE INDEX IF NOT EXISTS perencanaan_user_created_idx ON perencanaan (user_id, created_at);
CREATE INDEX IF NOT EXISTS fitur_plan_order_idx ON fitur (perencanaan_id, order_idx);
ALTER TABLE sub_fitur ADD COLUMN tasks_generated_at integer;
CREATE INDEX IF NOT EXISTS sub_fitur_feature_order_idx ON sub_fitur (fitur_id, order_idx);
ALTER TABLE kanban_task ADD COLUMN claimed_by text;
ALTER TABLE kanban_task ADD COLUMN claim_token_hash text;
ALTER TABLE kanban_task ADD COLUMN lease_expires_at integer;
ALTER TABLE kanban_task ADD COLUMN result_json text;
CREATE INDEX IF NOT EXISTS kanban_plan_status_created_idx ON kanban_task (perencanaan_id, status, created_at);
CREATE INDEX IF NOT EXISTS kanban_sub_feature_idx ON kanban_task (sub_fitur_id);
CREATE INDEX IF NOT EXISTS kanban_lease_idx ON kanban_task (status, lease_expires_at);
CREATE TABLE IF NOT EXISTS agent_token (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE, perencanaan_id text NOT NULL REFERENCES perencanaan(id) ON DELETE CASCADE, name text DEFAULT 'Local agent' NOT NULL, token_hash text NOT NULL, expires_at integer NOT NULL, revoked_at integer, created_at integer NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS agent_token_hash_idx ON agent_token (token_hash);
CREATE INDEX IF NOT EXISTS agent_token_scope_idx ON agent_token (user_id, perencanaan_id);
CREATE TABLE IF NOT EXISTS prd_document (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE, perencanaan_id text REFERENCES perencanaan(id) ON DELETE SET NULL, title text NOT NULL, content text NOT NULL, model text NOT NULL, usage_json text, created_at integer NOT NULL);
CREATE INDEX IF NOT EXISTS prd_user_created_idx ON prd_document (user_id, created_at);
CREATE TABLE IF NOT EXISTS rate_limit_bucket (key text PRIMARY KEY NOT NULL, count integer NOT NULL, reset_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS concurrency_slot (key text NOT NULL, slot integer NOT NULL, lease_id text NOT NULL, expires_at integer NOT NULL, PRIMARY KEY (key, slot));
CREATE INDEX IF NOT EXISTS concurrency_expiry_idx ON concurrency_slot (key, expires_at);

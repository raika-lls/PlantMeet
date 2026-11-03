ALTER TABLE accounts ADD COLUMN login_hash TEXT;
ALTER TABLE accounts ADD COLUMN password_hash TEXT;
ALTER TABLE accounts ADD COLUMN password_salt TEXT;
CREATE UNIQUE INDEX accounts_login ON accounts(login_hash);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL);
CREATE INDEX sessions_expiration ON sessions(expires);

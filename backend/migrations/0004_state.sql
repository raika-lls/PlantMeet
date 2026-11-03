CREATE TABLE account_state (owner TEXT NOT NULL REFERENCES accounts(id), section TEXT NOT NULL, payload TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(owner,section));

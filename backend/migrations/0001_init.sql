CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher','student')), token_hash TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
CREATE TABLE meetings (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES accounts(id), title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('Лекция','Практика')), room TEXT UNIQUE NOT NULL, closed INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE INDEX meeting_schedule ON meetings(date,time);
CREATE INDEX meeting_owner ON meetings(owner);

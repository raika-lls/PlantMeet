CREATE TABLE events (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL REFERENCES accounts(id),
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL,
 starts TEXT NOT NULL,
 ends TEXT NOT NULL,
 important INTEGER NOT NULL DEFAULT 0 CHECK(important IN (0,1)),
 all_day INTEGER NOT NULL DEFAULT 1 CHECK(all_day IN (0,1)),
 created INTEGER NOT NULL
);
CREATE INDEX events_owner_dates ON events(owner,starts,ends);
CREATE TABLE tasks (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL REFERENCES accounts(id),
 title TEXT NOT NULL,
 subject TEXT NOT NULL,
 study_group TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 starts TEXT NOT NULL,
 ends TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','assigned','completed')),
 created INTEGER NOT NULL
);
CREATE TABLE task_recipients (
 task TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 student TEXT NOT NULL REFERENCES accounts(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','completed')),
 PRIMARY KEY(task,student)
);
CREATE INDEX tasks_owner ON tasks(owner,created);
CREATE INDEX recipients_student ON task_recipients(student,task);
CREATE TABLE gradebooks (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL REFERENCES accounts(id),
 subject TEXT NOT NULL,
 study_group TEXT NOT NULL,
 year TEXT NOT NULL,
 period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 3),
 kind TEXT NOT NULL,
 UNIQUE(owner,subject,study_group,year,period,kind)
);
CREATE TABLE grades (
 gradebook TEXT NOT NULL REFERENCES gradebooks(id),
 student TEXT NOT NULL REFERENCES accounts(id),
 week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 15),
 score INTEGER CHECK(score BETWEEN 0 AND 100),
 absent INTEGER NOT NULL DEFAULT 0 CHECK(absent IN (0,1)),
 updated INTEGER NOT NULL,
 CHECK((absent=1 AND score IS NULL) OR (absent=0 AND score IS NOT NULL)),
 PRIMARY KEY(gradebook,student,week)
);
CREATE INDEX grades_student ON grades(student,gradebook);
CREATE TABLE visits (
 id TEXT PRIMARY KEY,
 meeting TEXT NOT NULL REFERENCES meetings(id),
 student TEXT NOT NULL REFERENCES accounts(id),
 entered INTEGER NOT NULL,
 seen INTEGER NOT NULL,
 exited INTEGER,
 CHECK(exited IS NULL OR exited>=entered)
);
CREATE INDEX visits_meeting_student ON visits(meeting,student,entered);
CREATE TABLE absences (
 meeting TEXT NOT NULL REFERENCES meetings(id),
 student TEXT NOT NULL REFERENCES accounts(id),
 marked INTEGER NOT NULL,
 PRIMARY KEY(meeting,student)
);
CREATE TABLE recordings (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL REFERENCES accounts(id),
 meeting TEXT REFERENCES meetings(id) ON DELETE SET NULL,
 title TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes>0),
 created INTEGER NOT NULL,
 expires INTEGER NOT NULL CHECK(expires>created)
);
CREATE INDEX recordings_owner_expiration ON recordings(owner,expires);
CREATE INDEX recordings_expiration ON recordings(expires);
CREATE TABLE audit_log (
 id TEXT PRIMARY KEY,
 actor TEXT REFERENCES accounts(id),
 action TEXT NOT NULL,
 entity TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 created INTEGER NOT NULL
);
CREATE INDEX audit_actor_time ON audit_log(actor,created);

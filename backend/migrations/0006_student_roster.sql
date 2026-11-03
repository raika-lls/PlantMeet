CREATE TABLE student_roster (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 study_group TEXT NOT NULL,
 subgroup TEXT NOT NULL,
 UNIQUE(name,study_group)
);
CREATE INDEX student_roster_group ON student_roster(study_group,subgroup);

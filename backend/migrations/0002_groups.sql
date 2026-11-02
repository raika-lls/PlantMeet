ALTER TABLE accounts ADD COLUMN study_group TEXT NOT NULL DEFAULT 'ИС-24А';
ALTER TABLE accounts ADD COLUMN subgroup TEXT NOT NULL DEFAULT 'Подгруппа 1';
ALTER TABLE meetings ADD COLUMN study_group TEXT NOT NULL DEFAULT 'ИС-24А';
ALTER TABLE meetings ADD COLUMN subgroup TEXT NOT NULL DEFAULT 'Вся группа';
CREATE INDEX meeting_audience ON meetings(study_group,subgroup,date);

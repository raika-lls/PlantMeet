import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const file=join(mkdtempSync(join(tmpdir(),'plantmeet-db-')),'test.sqlite');
let db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON');
for(const f of readdirSync(new URL('./migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('./migrations/'+f,import.meta.url),'utf8'));
db.prepare('INSERT INTO accounts(id,name,role,token_hash,created) VALUES(?,?,?,?,?)').run('teacher','Жарасхан','teacher','teacher-hash',1);
db.prepare('INSERT INTO accounts(id,name,role,token_hash,created) VALUES(?,?,?,?,?)').run('student','Арайлым','student','student-hash',1);
test('Events, tasks, recipients and grades survive database reopen',()=>{
 db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?)').run('e1','teacher','Консультация','','Персональные','2026-11-03','2026-11-03',0,1,1);
 db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)').run('t1','teacher','Лабораторная','Защита','ИС-24А','','2026-11-03','2026-11-10','assigned',1);
 db.prepare('INSERT INTO task_recipients(task,student) VALUES(?,?)').run('t1','student');
 db.prepare('INSERT INTO gradebooks VALUES(?,?,?,?,?,?,?)').run('g1','teacher','Защита','ИС-24А','2026-2027',1,'Практика');
 db.prepare('INSERT INTO grades VALUES(?,?,?,?,?,?)').run('g1','student',1,90,0,1);
 db.close();db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON');
 assert.equal(db.prepare('SELECT score FROM grades').get().score,90);assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n,1);assert.equal(db.prepare('SELECT count(*) AS n FROM task_recipients').get().n,1);
});
test('Invalid grade and orphan recipient are rejected',()=>{
 assert.throws(()=>db.prepare('INSERT INTO grades VALUES(?,?,?,?,?,?)').run('g1','student',2,101,0,1));
 assert.throws(()=>db.prepare('INSERT INTO task_recipients(task,student) VALUES(?,?)').run('missing','student'));
});
test('Related task changes roll back together',()=>{db.exec('BEGIN');try{db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)').run('rollback','teacher','X','Защита','ИС-24А','','2026-11-03','2026-11-10','assigned',1);db.prepare('INSERT INTO task_recipients(task,student) VALUES(?,?)').run('rollback','missing');db.exec('COMMIT')}catch{db.exec('ROLLBACK')}assert.equal(db.prepare('SELECT count(*) AS n FROM tasks WHERE id=?').get('rollback').n,0)});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle} from './lib/service.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_vengeful_zodiak.sql','utf8').replaceAll('--> statement-breakpoint',''));
function prepare(sql,values=[]){return {bind(...v){return prepare(sql,v)},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return sqlite.prepare(sql).run(...values)}}}
const db={prepare,async batch(statements){sqlite.exec('BEGIN');try{const r=await Promise.all(statements.map(s=>s.run()));sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const files=new Map(),bucket={async put(k,v){files.set(k,v)},async delete(k){files.delete(k)}};
const teacher={userId:'teacher-1'},student={userId:'student-1'},other={userId:'teacher-2'};
async function call(path,identity,data,method='POST'){const req=new Request('https://plantmeet.test/api/'+path,data===undefined?{}:{method,headers:{Origin:'https://plantmeet.test','Content-Type':'application/json'},body:JSON.stringify(data)});const response=await handle(req,db,bucket,identity);return {status:response.status,value:await response.json()}}
test('Shared classroom: registration, authorization, persistence, attendance and records',async()=>{
 assert.equal((await call('state',null)).status,401);
 assert.equal((await call('register',teacher,{name:'Преподаватель',role:'teacher'})).status,201);
 assert.equal((await call('register',student,{name:'Арайлым',role:'student'})).status,201);
 assert.equal((await call('register',other,{name:'Другой преподаватель',role:'teacher'})).status,201);
 assert.equal((await call('register',student,{name:'Арайлым',role:'teacher'})).status,409);
 assert.equal((await call('state',student)).value.lessons.length,3);
 const lesson={title:'Сетевое программирование',date:'2026-10-13',time:'14:00',kind:'Практика'};
 assert.equal((await call('lessons',student,lesson)).status,403);
 assert.equal((await call('lessons',teacher,{...lesson,date:'2026-02-31'})).status,400);
 const created=await call('lessons',teacher,lesson);assert.equal(created.status,201);
 const id=created.value.id,seen=(await call('state',student)).value.lessons.find(l=>l.id===id);assert.equal(seen.title,lesson.title);assert.equal(seen.duration,90);
 assert.equal((await call('meetings/'+id,student)).value.meeting.room,(await call('meetings/'+id,teacher)).value.meeting.room);
 assert.equal((await call('meetings/'+id+'/join',student,{})).status,200);
 assert.equal((await call('meetings/'+id+'/attendance',student)).status,403);
 assert.equal((await call('meetings/'+id+'/close',student,{})).status,403);
 assert.equal((await call('meetings/'+id+'/close',other,{})).status,403);
 assert.equal((await call('meetings/'+id+'/attendance',teacher)).value.students[0].status,'Присутствовал(а)');
 const bytes=Buffer.from([26,69,223,163,0,1]);const uploaded=await handle(new Request('https://plantmeet.test/api/recordings?meeting='+id,{method:'POST',headers:{'Content-Length':String(bytes.length)},body:bytes}),db,bucket,student);assert.equal(uploaded.status,201);const rid=(await uploaded.json()).id;
 assert.equal((await call('recordings/'+rid,other,{},'DELETE')).status,403);
 assert.equal((await call('recordings/'+rid,student,{},'DELETE')).status,200);assert.equal(files.has(rid),false);
 assert.equal((await call('meetings/'+id+'/close',teacher,{})).status,200);assert.equal((await call('meetings/'+id+'/join',student,{})).status,409);
 assert.equal((await call('meetings/'+id+'/attendance',teacher)).value.students[0].status,'Присутствовал(а)');
 const initial=(await call('state',teacher)).value.lessons.find(l=>l.id==='initial-0');await call('meetings/'+initial.id+'/close',teacher,{});assert.equal((await call('meetings/'+initial.id+'/attendance',teacher)).value.students[0].status,'н.я.');
});

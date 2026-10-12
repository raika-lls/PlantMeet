import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handle,expiration} from './lib/service.mjs';
const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint','')); 
function prepare(sql,values=[]){return {bind(...v){return prepare(sql,v)},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return sqlite.prepare(sql).run(...values)}}}
const db={prepare,async batch(statements){sqlite.exec('BEGIN');try{const r=await Promise.all(statements.map(s=>s.run()));sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const files=new Map(),bucket={async put(k,v){files.set(k,v)},async delete(k){files.delete(k)},async get(k,{range}={}){const bytes=files.get(k);if(!bytes)return null;const partial=range?.get('Range')==='bytes=0-3';return {body:partial?bytes.slice(0,4):bytes,size:bytes.byteLength,...(partial?{range:{offset:0,length:4}}:{})}}};
const teacher={userId:'teacher-1'},student={userId:'student-1'},other={userId:'teacher-2'};
async function call(path,identity,data,method='POST'){const req=new Request('https://plantmeet.test/api/'+path,data===undefined?{}:{method,headers:{Origin:'https://plantmeet.test','Content-Type':'application/json'},body:JSON.stringify(data)});const response=await handle(req,db,bucket,identity);return {status:response.status,value:await response.json()}}
test('Shared classroom: registration, authorization, persistence, attendance and records',async()=>{
 assert.equal((await call('state',null)).status,401);
 assert.equal((await call('register',teacher,{name:'Преподаватель',role:'teacher'})).status,201);
 assert.equal((await call('register',student,{name:'Арайлым',role:'student'})).status,201);
 assert.equal((await call('register',other,{name:'Другой преподаватель',role:'teacher'})).status,201);
 assert.equal((await call('register',student,{name:'Арайлым',role:'teacher'})).status,409);
 assert.equal((await call('state',student)).value.lessons.length,3);
 const names=(await call('state',other)).value.lessons;assert.equal(names.find(l=>l.id==='initial-1').teacher,'Қайупов Е.К.');assert.equal(names.find(l=>l.id==='initial-2').teacher,'Сұлтанғазиева А.Н.');assert.equal(names.find(l=>l.id==='initial-0').teacher,'Преподаватель');
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
 assert.equal((await call('meetings/'+id+'/join',student,{})).status,200);
 assert.equal((await call('meetings/'+id+'/attendance',teacher)).value.students[0].visits.length,1);
 const people=(await call('meetings/'+id+'/participants',teacher)).value.people;assert.equal(people[0].role,'student');assert.equal(people[0].online,true);
 await call('meetings/'+id+'/leave',student,{});let journal=(await call('meetings/'+id+'/attendance',teacher)).value.students[0];assert.ok(journal.left);assert.equal(journal.visits[0].reason,'leave');
 await call('meetings/'+id+'/join',student,{});journal=(await call('meetings/'+id+'/attendance',teacher)).value.students[0];assert.equal(journal.visits.length,2);assert.equal(journal.left,null);
 sqlite.prepare('UPDATE attendance SET seen=? WHERE meeting=?').run(Date.now()-60000,id);sqlite.prepare('UPDATE visits SET seen=? WHERE meeting=? AND left IS NULL').run(Date.now()-60000,id);
 assert.equal((await call('meetings/'+id+'/participants',teacher)).value.people[0].online,false);
 await call('meetings/'+id+'/heartbeat',student,{});assert.equal((await call('meetings/'+id+'/participants',teacher)).value.people[0].online,true);
 assert.equal((await call('meetings/'+id+'/attendance',teacher)).value.students[0].visits.length,3);
 await call('register',{userId:'absent'},{name:'Я отсутствующий',role:'student'});
 const bytes=Buffer.from([26,69,223,163,0,1]);const uploaded=await handle(new Request('https://plantmeet.test/api/recordings?meeting='+id,{method:'POST',headers:{'Content-Length':String(bytes.length)},body:bytes}),db,bucket,student);assert.equal(uploaded.status,201);const rid=(await uploaded.json()).id;
 // Only the recording author can list, play, download or delete it, including the meeting's teacher.
 assert.deepEqual((await call('state',student)).value.records.map(r=>r.id),[rid]);
 assert.equal((await call('state',teacher)).value.records.length,0);assert.equal((await call('state',other)).value.records.length,0);
 for(const who of [teacher,other]){assert.equal((await call('recordings/'+rid,who)).status,404);assert.equal((await call('recordings/'+rid,who,{},'DELETE')).status,404);const denied=await handle(new Request('https://plantmeet.test/api/recordings/'+rid,{headers:{Range:'bytes=0-3'}}),db,bucket,who);assert.equal(denied.status,404)}
 assert.equal((await call('recordings/'+rid,null)).status,401);
 const playback=await handle(new Request('https://plantmeet.test/api/recordings/'+rid),db,bucket,student);assert.equal(playback.status,200);assert.deepEqual(Buffer.from(await playback.arrayBuffer()),bytes);assert.equal(playback.headers.get('Cache-Control'),'private,no-store');
 const partial=await handle(new Request('https://plantmeet.test/api/recordings/'+rid,{headers:{Range:'bytes=0-3'}}),db,bucket,student);assert.equal(partial.status,206);assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(0,4));
 await call('meetings/'+id+'/join',teacher,{});const teacherUpload=await handle(new Request('https://plantmeet.test/api/recordings?meeting='+id,{method:'POST',headers:{'Content-Length':String(bytes.length)},body:bytes}),db,bucket,teacher);assert.equal(teacherUpload.status,201);const teacherRid=(await teacherUpload.json()).id;
 assert.deepEqual((await call('state',teacher)).value.records.map(r=>r.id),[teacherRid]);assert.deepEqual((await call('state',student)).value.records.map(r=>r.id),[rid]);assert.equal((await call('recordings/'+teacherRid,student)).status,404);
 assert.equal((await call('recordings/'+teacherRid,teacher,{},'DELETE')).status,200);assert.equal(files.has(teacherRid),false);
 assert.equal((await call('recordings/'+rid,student,{},'DELETE')).status,200);assert.equal(files.has(rid),false);
 assert.equal((await call('meetings/'+id+'/close',teacher,{})).status,200);assert.equal((await call('meetings/'+id+'/join',student,{})).status,409);
 assert.equal((await call('meetings/'+id+'/attendance',teacher)).value.students[0].status,'Присутствовал(а)');
 const final=(await call('meetings/'+id+'/attendance',teacher)).value;assert.ok(final.students[0].left);assert.equal(final.students[0].visits.at(-1).reason,'closed');assert.equal(final.students[1].status,'н.я.');
 const initial=(await call('state',teacher)).value.lessons.find(l=>l.id==='initial-0');await call('meetings/'+initial.id+'/close',teacher,{});assert.equal((await call('meetings/'+initial.id+'/attendance',teacher)).value.students[0].status,'н.я.');
});
test('Recordings are kept for one calendar month, including month end',()=>{assert.equal(new Date(expiration(Date.parse('2026-01-31T12:00:00Z'))).toISOString(),'2026-02-28T12:00:00.000Z');assert.equal(new Date(expiration(Date.parse('2028-01-31T12:00:00Z'))).toISOString(),'2028-02-29T12:00:00.000Z');});

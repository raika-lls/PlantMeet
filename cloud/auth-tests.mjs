import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {authenticatedHandle} from './lib/auth.mjs';
test('Email auth: durable login, role authorization, session revocation, CSRF and rate limits',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
 function prepare(query,values=[]){return {bind(...v){return prepare(query,v)},async first(){return sql.prepare(query).get(...values)||null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){return sql.prepare(query).run(...values)}}}
 const db={prepare,async batch(items){sql.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}},bucket={async delete(){}};
 async function call(path,body,cookie='',extra={}){const response=await authenticatedHandle(new Request('https://plantmeet.test/api/'+path,{method:body?'POST':'GET',headers:{Origin:'https://plantmeet.test',Cookie:cookie,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined}),db,bucket);return {status:response.status,body:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0],headers:response.headers};}
 const teacher={name:'Учитель',email:'teacher@example.test',password:'test-only-password-123',role:'teacher'};
 const student={...teacher,name:'Студент',email:'student@example.test',role:'student'};
 assert.equal((await call('state')).status,401);
 assert.equal((await call('auth/register',{...teacher,password:'123'})).status,400);
 const t=await call('auth/register',teacher);assert.equal(t.status,201);assert.match(t.headers.get('Set-Cookie'),/HttpOnly; SameSite=Lax;.*Secure/);
 assert.equal((await call('state',null,t.cookie)).body.lessons.length,3);
 const s=await call('auth/register',student);assert.equal(s.status,201);
 assert.equal((await call('auth/register',{...student,role:'teacher'})).status,409);
 assert.equal((await call('auth/login',{...student,password:'wrong-password'})).status,401);
 const login=await call('auth/login',{email:'STUDENT@example.test',password:student.password});assert.equal(login.status,200);
 assert.equal((await call('state',null,login.cookie)).body.user.role,'student');
 const lesson={title:'Общая встреча',date:'2026-10-30',time:'10:00',kind:'Лекция'};
 assert.equal((await call('lessons',lesson,s.cookie)).status,403);
 assert.equal((await call('lessons',lesson,t.cookie,{Origin:'https://evil.test'})).status,403);
 assert.equal((await call('lessons',lesson,t.cookie)).status,201);
 assert.ok((await call('state',null,login.cookie)).body.lessons.some(m=>m.title===lesson.title));
 assert.equal((await call('register',{name:'Hack',role:'teacher'},s.cookie)).status,404);
 assert.equal((await call('auth/logout',{},login.cookie)).status,200);
 assert.equal((await call('state',null,login.cookie)).status,401);
 assert.equal((await call('state',null,'pm_session='+'a'.repeat(64))).status,401);
 sql.exec('UPDATE sessions SET expires=0');assert.equal((await call('state',null,t.cookie)).status,401);
 const account=sql.prepare('SELECT * FROM accounts WHERE email=?').get(student.email);assert.notEqual(account.password,student.password);assert.equal(account.password.length,64);
 assert.ok(sql.prepare('SELECT token FROM sessions LIMIT 1').get().token!==s.cookie.split('=')[1]);
 let limited;for(let i=0;i<14;i++)limited=await call('auth/login',{email:'unknown@example.test',password:'invalid-password'});assert.equal(limited.status,429);
});

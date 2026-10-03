import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url)), data=process.env.PLANTMEET_DATA||path.join(root,'data');
fs.mkdirSync(path.join(data,'recordings'),{recursive:true});
const db=new DatabaseSync(path.join(data,'plantmeet.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS profile(id INTEGER PRIMARY KEY,name TEXT,email TEXT,group_name TEXT,program TEXT);
CREATE TABLE IF NOT EXISTS lessons(id TEXT PRIMARY KEY,title TEXT,teacher TEXT,date TEXT,time TEXT,duration INTEGER,kind TEXT);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,lesson_id TEXT,started INTEGER,ended INTEGER);
CREATE TABLE IF NOT EXISTS attendance(session_id TEXT,student TEXT,joined INTEGER,left_at INTEGER,PRIMARY KEY(session_id,student));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,session_id TEXT,name TEXT,text TEXT,created INTEGER);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE TABLE IF NOT EXISTS recordings(id TEXT PRIMARY KEY,session_id TEXT,title TEXT,created INTEGER,expires INTEGER,filename TEXT,size INTEGER);
CREATE INDEX IF NOT EXISTS idx_recordings_expires ON recordings(expires);`);
export const roster=['Арайлым','Ораз Нурайлым','Серик Балжан','Малиева Аружан','Конаева Сабина','Еркын Сабит','Нурболат Арайлым','Ахмет Данияр','Сулеймен Айдана','Толеу Алишер','Бекзат Мадина','Касым Аян'];
if(!db.prepare('SELECT id FROM profile').get()) db.prepare('INSERT INTO profile VALUES(1,?,?,?,?)').run(roster[0],'arailym@mail.kz','ИС-302','Информационные системы');
const subjects=[
 ['Защита информации от вредоносного программного обеспечения','Жарасхан Н.Ж.'],
 ['Основы языка программирования Go','Қайупов Е.К.'],
 ['Прикладное программное обеспечение информационных систем','Мусайф М.'],
 ['Сетевое программирование','Таштай Б.А.'],
 ['Разработка мобильных приложений на Kotlin','Сұлтанғазиева А.Н.']
];
if(!db.prepare('SELECT name FROM migrations WHERE name=?').get('subjects-and-name-v2')){
 db.exec('BEGIN');
 try{
  db.prepare('UPDATE profile SET name=? WHERE id=1').run('Арайлым');
  db.prepare('UPDATE attendance SET student=? WHERE student IN (?,?)').run('Арайлым','Арайлым Женискызы','Женискызы Арайлым');
  db.prepare('UPDATE messages SET name=? WHERE name IN (?,?)').run('Арайлым','Арайлым Женискызы','Женискызы Арайлым');
  subjects.forEach(([title,teacher],i)=>{
   const d=new Date();d.setDate(d.getDate()+[0,0,1,2,3][i]);
   const date=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
   for(const kind of ['Лекция','Практика']){
    const id=String(i+1)+(kind==='Практика'?'-practice':'');
    const time=i===1?(kind==='Лекция'?'14:00':'15:00'):(kind==='Лекция'?'10:00':'11:00');
    db.prepare('INSERT INTO lessons VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,teacher=excluded.teacher,date=excluded.date,time=excluded.time,duration=excluded.duration,kind=excluded.kind').run(id,title,teacher,date,time,kind==='Лекция'?50:90,kind);
   }
  });
  db.prepare("UPDATE lessons SET duration=CASE kind WHEN 'Лекция' THEN 50 WHEN 'Практика' THEN 90 ELSE duration END").run();
  db.prepare('INSERT INTO migrations VALUES(?)').run('subjects-and-name-v2');
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function expiry(created){const d=new Date(created);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d.getTime();}
function cleanup(){for(const r of db.prepare('SELECT * FROM recordings WHERE expires<=?').all(Date.now())){fs.rmSync(path.join(data,'recordings',r.filename),{force:true});db.prepare('DELETE FROM recordings WHERE id=?').run(r.id);}}
cleanup();setInterval(cleanup,60_000).unref();
function finish(id){const s=db.prepare('SELECT * FROM sessions WHERE id=?').get(id);if(!s)throw Error('Встреча не найдена');if(!s.ended){const n=Date.now();db.prepare('UPDATE sessions SET ended=? WHERE id=?').run(n,id);db.prepare('UPDATE attendance SET left_at=? WHERE session_id=? AND joined IS NOT NULL AND left_at IS NULL').run(n,id);}return {ok:true};}
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req,max=100_000){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('Файл слишком большой');chunks.push(chunk);}return Buffer.concat(chunks);}
const required=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Проверьте обязательные поля');return v.trim();};
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');const p=u.pathname;
 if(req.headers.host!==`localhost:${port}`&&req.headers.host!==`127.0.0.1:${port}`)return json(res,403,{error:'Недопустимый адрес'});
 if(req.method!=='GET'&&req.headers.origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin))return json(res,403,{error:'Запрос отклонён'});
 if(p==='/api/state'&&req.method==='GET'){cleanup();return json(res,200,{profile:db.prepare('SELECT * FROM profile').get(),lessons:db.prepare('SELECT * FROM lessons ORDER BY date,time').all(),recordings:db.prepare('SELECT * FROM recordings ORDER BY created DESC').all(),sessions:db.prepare('SELECT s.*,l.title FROM sessions s JOIN lessons l ON l.id=s.lesson_id ORDER BY started DESC').all(),roster});}
 if(p==='/api/lessons'&&req.method==='POST'){const b=JSON.parse(await body(req));if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||Number.isNaN(Date.parse(b.date))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time))throw Error('Укажите дату и время');if(!['Лекция','Практика'].includes(b.kind))throw Error('Выберите лекцию или практику');const duration=b.kind==='Лекция'?50:90;const id=randomUUID();db.prepare('INSERT INTO lessons VALUES(?,?,?,?,?,?,?)').run(id,required(b.title),required(b.teacher),b.date,b.time,duration,required(b.kind));return json(res,201,{id});}
 if(p==='/api/join'&&req.method==='POST'){const b=JSON.parse(await body(req));if(!db.prepare('SELECT id FROM lessons WHERE id=?').get(b.lesson_id))throw Error('Занятие не найдено');const id=randomUUID(),n=Date.now();db.exec('BEGIN');try{db.prepare('INSERT INTO sessions VALUES(?,?,?,NULL)').run(id,b.lesson_id,n);for(const student of roster)db.prepare('INSERT INTO attendance VALUES(?,?,?,NULL)').run(id,student,student===roster[0]?n:null);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,201,{id,started:n});}
 if(p==='/api/participants'&&req.method==='POST'){const b=JSON.parse(await body(req));const s=db.prepare('SELECT * FROM sessions WHERE id=?').get(b.id);if(!s||s.ended)throw Error('Встреча завершена');if(!roster.slice(1).includes(b.name))throw Error('Участник не найден');db.prepare('UPDATE attendance SET joined=COALESCE(joined,?) WHERE session_id=? AND student=?').run(Date.now(),b.id,b.name);return json(res,200,{ok:true});}
 if(p==='/api/leave'&&req.method==='POST'){const b=JSON.parse(await body(req));return json(res,200,finish(required(b.id)));}
 if(p==='/api/attendance'&&req.method==='GET')return json(res,200,db.prepare('SELECT * FROM attendance WHERE session_id=?').all(u.searchParams.get('id')));
 if(p==='/api/messages'&&req.method==='GET')return json(res,200,db.prepare('SELECT * FROM messages WHERE session_id=? ORDER BY id').all(u.searchParams.get('id')));
 if(p==='/api/messages'&&req.method==='POST'){const b=JSON.parse(await body(req));const s=db.prepare('SELECT * FROM sessions WHERE id=?').get(b.id);if(!s||s.ended)throw Error('Встреча завершена');const name=b.demo&&roster.includes(b.name)?b.name:db.prepare('SELECT name FROM profile').get().name;db.prepare('INSERT INTO messages(session_id,name,text,created) VALUES(?,?,?,?)').run(b.id,name,required(b.text,2000),Date.now());return json(res,201,{ok:true});}
 if(p==='/api/recordings/delete'&&req.method==='POST'){
  const b=JSON.parse(await body(req));const id=required(b.id);
  const r=db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
  if(!r)return json(res,404,{error:'Запись уже удалена или не найдена'});
  fs.rmSync(path.join(data,'recordings',r.filename),{force:true});
  db.prepare('DELETE FROM recordings WHERE id=?').run(id);
  return json(res,200,{ok:true});
 }
 if(p==='/api/recordings'&&req.method==='POST'){const id=u.searchParams.get('session');const s=db.prepare('SELECT s.*,l.title FROM sessions s JOIN lessons l ON s.lesson_id=l.id WHERE s.id=?').get(id);if(!s)throw Error('Встреча не найдена');const bytes=await body(req,250*1024*1024);if(bytes.length<4||bytes.subarray(0,4).toString('hex')!=='1a45dfa3')throw Error('Ожидается видеозапись WebM');const rid=randomUUID(),file=rid+'.webm',now=Date.now();fs.writeFileSync(path.join(data,'recordings',file),bytes);db.prepare('INSERT INTO recordings VALUES(?,?,?,?,?,?,?)').run(rid,id,s.title,now,expiry(now),file,bytes.length);return json(res,201,{id:rid});}
 if(p.startsWith('/recordings/')&&req.method==='GET'){cleanup();const r=db.prepare('SELECT * FROM recordings WHERE filename=?').get(path.basename(p));if(!r)return json(res,404,{error:'Запись не найдена или срок хранения истёк'});const f=path.join(data,'recordings',r.filename),size=fs.statSync(f).size;const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');let start=0,end=size-1;if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}}res.writeHead(match?206:200,{'Content-Type':'video/webm','Accept-Ranges':'bytes','Content-Length':end-start+1,...(match?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});return fs.createReadStream(f,{start,end}).pipe(res);}
 if(p.startsWith('/api/'))return json(res,404,{error:'Действие не найдено'});
 if(req.method!=='GET')return json(res,405,{error:'Метод не поддерживается'});
 const pathname=p==='/'?'/index.html':p;const f=path.resolve(root,'public','.'+decodeURIComponent(pathname));if(!f.startsWith(path.join(root,'public')+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return json(res,404,{error:'Страница не найдена'});
 res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(f)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});fs.createReadStream(f).pipe(res);
 }catch(e){console.error(e);json(res,400,{error:e.message instanceof String?String(e.message):e.message||'Не удалось выполнить действие'});}});
const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`PlantMeet: http://localhost:${port}`));

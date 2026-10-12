const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
function fail(message,status=400){throw Object.assign(new Error(message),{status})}
const text=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('Проверьте обязательные поля');return v.trim()};
const guid=()=>crypto.randomUUID();
const teacherSql="CASE m.id WHEN 'initial-1' THEN 'Қайупов Е.К.' WHEN 'initial-2' THEN 'Сұлтанғазиева А.Н.' ELSE u.name END";
async function stale(db,id,now){await db.batch([db.prepare('UPDATE visits SET left=seen,reason=? WHERE meeting=? AND left IS NULL AND seen<?').bind('disconnect',id,now-45000),db.prepare('UPDATE attendance SET left=seen WHERE meeting=? AND left IS NULL AND seen<?').bind(id,now-45000)])}
async function endVisit(db,id,uid,now,reason){await db.batch([db.prepare('UPDATE visits SET left=?,seen=?,reason=? WHERE meeting=? AND user=? AND left IS NULL').bind(now,now,reason,id,uid),db.prepare('UPDATE attendance SET left=?,seen=? WHERE meeting=? AND user=? AND left IS NULL').bind(now,now,id,uid)])}

export function expiration(now){const d=new Date(now),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return +d;}
export async function handle(request,db,bucket,identity){try{
 const url=new URL(request.url),route=url.pathname.slice(5),method=request.method;
 if(method!=='GET'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)fail('Запрос отклонён',403);
 if(!identity)return json({error:'Войдите в аккаунт'},401);
 const uid=identity.userId,row=await db.prepare('SELECT id,name,role FROM users WHERE id=?').bind(uid).first();
 const read=async()=>{if(Number(request.headers.get('Content-Length'))>20000)fail('Слишком большой запрос');return request.json()};
 if(route==='me'&&method==='GET')return json({user:row});
 if(route==='register'&&method==='POST'){
  if(row)fail('Вы уже зарегистрированы',409);const b=await read(),name=text(b.name,80);if(!['teacher','student'].includes(b.role))fail('Выберите роль');
  await db.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(uid,name,b.role,Date.now()).run();
  if(b.role==='teacher'){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qyzylorda',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const titles=['Защита информации от вредоносного программного обеспечения','Основы языка программирования Go','Разработка мобильных приложений на Kotlin'];await db.batch(titles.map((title,i)=>db.prepare('INSERT OR IGNORE INTO meetings(id,owner,title,date,time,kind,duration,room,created) VALUES(?,?,?,?,?,?,?,?,?)').bind('initial-'+i,uid,title,day,['10:00','12:00','15:00'][i],i===1?'Практика':'Лекция',i===1?90:50,'PlantMeet'+guid().replaceAll('-',''),Date.now())))}return json({ok:true},201);
 }
 if(!row)fail('Завершите регистрацию',403);
 if(route==='state'&&method==='GET'){
  for(const r of (await db.prepare('SELECT id FROM recordings WHERE expires<=? LIMIT 100').bind(Date.now()).all()).results){await bucket.delete(r.id);await db.prepare('DELETE FROM recordings WHERE id=?').bind(r.id).run()}
  return json({user:row,lessons:(await db.prepare(`SELECT m.id,m.owner,m.title,m.date,m.time,m.kind,m.duration,m.closed,${teacherSql} AS teacher FROM meetings m JOIN users u ON u.id=m.owner ORDER BY m.closed IS NOT NULL,m.date,m.time`).all()).results,records:(await db.prepare('SELECT r.*,m.title FROM recordings r JOIN meetings m ON m.id=r.meeting WHERE r.expires>? ORDER BY r.created DESC').bind(Date.now()).all()).results});
 }
 if(route==='lessons'&&method==='POST'){
  if(row.role!=='teacher')fail('Только преподаватель может создавать конференции',403);
  const b=await read(),title=text(b.title),date=text(b.date,10),time=text(b.time,5);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!['Лекция','Практика'].includes(b.kind))fail('Проверьте дату, время и формат');
  const id=guid();await db.prepare('INSERT INTO meetings VALUES(?,?,?,?,?,?,?,?,NULL,?)').bind(id,uid,title,date,time,b.kind,b.kind==='Лекция'?50:90,'PlantMeet'+guid().replaceAll('-',''),Date.now()).run();return json({id},201);
 }
 const match=/^meetings\/([^/]+)(?:\/(join|heartbeat|leave|close|attendance|participants))?$/.exec(route);
 if(match){const m=await db.prepare(`SELECT m.*,${teacherSql} AS teacher FROM meetings m JOIN users u ON u.id=m.owner WHERE m.id=?`).bind(match[1]).first();if(!m)fail('Встреча не найдена',404);const action=match[2],now=Date.now();await stale(db,m.id,now);
  if(!action&&method==='GET')return json({meeting:m});
  if(action==='participants'&&method==='GET'){const people=(await db.prepare('SELECT u.id,u.name,u.role,a.joined,a.seen,a.left FROM attendance a JOIN users u ON u.id=a.user WHERE a.meeting=? ORDER BY u.role,u.name').bind(m.id).all()).results;return json({people:people.map(p=>({...p,online:!p.left&&p.seen>=now-45000,host:p.id===m.owner}))})}
  if(action==='attendance'&&method==='GET'){
   if(row.role!=='teacher'||m.owner!==uid)fail('Журнал доступен преподавателю этой встречи',403);
   const list=(await db.prepare("SELECT u.id,u.name,a.joined,a.seen,a.left FROM users u LEFT JOIN attendance a ON a.user=u.id AND a.meeting=? WHERE u.role='student' AND u.created<=? ORDER BY u.name").bind(m.id,m.closed||now).all()).results;
   const visits=(await db.prepare('SELECT * FROM visits WHERE meeting=? ORDER BY joined,id').bind(m.id).all()).results;
   return json({meeting:m,students:list.map(a=>({...a,status:a.joined?'Присутствовал(а)':m.closed?'н.я.':'Ожидается',visits:visits.filter(v=>v.user===a.id),duration:visits.filter(v=>v.user===a.id).reduce((sum,v)=>sum+Math.max(0,(v.left||v.seen)-v.joined),0)}))});
  }
  if(method!=='POST')fail('Метод не поддерживается',405);
  if(action==='leave'){await endVisit(db,m.id,uid,now,'leave');return json({ok:true})}
  if(m.closed)fail('Встреча завершена',409);
  if(action==='join'){
   const open=await db.prepare('SELECT id FROM visits WHERE meeting=? AND user=? AND left IS NULL').bind(m.id,uid).first();
   const writes=[db.prepare('INSERT INTO attendance VALUES(?,?,?,?,NULL) ON CONFLICT(meeting,user) DO UPDATE SET seen=excluded.seen,left=NULL').bind(m.id,uid,now,now)];
   if(!open)writes.push(db.prepare('INSERT INTO visits SELECT ?,?,?,?,?,NULL,NULL WHERE NOT EXISTS (SELECT 1 FROM visits WHERE meeting=? AND user=? AND left IS NULL)').bind(guid(),m.id,uid,now,now,m.id,uid));
   await db.batch(writes);return json({ok:true});
  }
  if(action==='heartbeat'){const previous=await db.prepare('SELECT joined,left FROM attendance WHERE meeting=? AND user=?').bind(m.id,uid).first();if(previous){const writes=[db.prepare('UPDATE attendance SET seen=?,left=NULL WHERE meeting=? AND user=?').bind(now,m.id,uid),db.prepare('UPDATE visits SET seen=? WHERE meeting=? AND user=? AND left IS NULL').bind(now,m.id,uid)];if(previous.left)writes.push(db.prepare('INSERT INTO visits SELECT ?,?,?,?,?,NULL,NULL WHERE NOT EXISTS (SELECT 1 FROM visits WHERE meeting=? AND user=? AND left IS NULL)').bind(guid(),m.id,uid,now,now,m.id,uid));await db.batch(writes)}return json({ok:true})}
  if(action==='close'){
   if(row.role!=='teacher'||m.owner!==uid)fail('Завершить встречу может её преподаватель',403);
   await db.batch([db.prepare('UPDATE meetings SET closed=? WHERE id=?').bind(now,m.id),db.prepare('UPDATE attendance SET left=?,seen=? WHERE meeting=? AND left IS NULL').bind(now,now,m.id),db.prepare('UPDATE visits SET left=?,seen=?,reason=? WHERE meeting=? AND left IS NULL').bind(now,now,'closed',m.id)]);return json({ok:true});
  }

 }
 if(route==='recordings'&&method==='POST'){
  const meeting=url.searchParams.get('meeting');if(!await db.prepare('SELECT user FROM attendance WHERE user=? AND meeting=?').bind(uid,meeting).first())fail('Сначала присоединитесь к встрече',403);
  const length=Number(request.headers.get('Content-Length'));if(!length||length>25*1024*1024)fail('Максимальный размер записи 25 МБ',413);const blob=await request.arrayBuffer();if(blob.byteLength>25*1024*1024||new Uint8Array(blob).slice(0,4).join(',')!=='26,69,223,163')fail('Ожидается запись WebM');
  const id=guid(),now=Date.now();await bucket.put(id,blob,{httpMetadata:{contentType:'video/webm'}});try{await db.prepare('INSERT INTO recordings VALUES(?,?,?,?,?,?)').bind(id,meeting,uid,now,expiration(now),blob.byteLength).run()}catch(e){await bucket.delete(id);throw e}return json({id},201);
 }
 const record=/^recordings\/([^/]+)$/.exec(route);
 if(record){const r=await db.prepare('SELECT * FROM recordings WHERE id=?').bind(record[1]).first();if(!r||r.expires<=Date.now())fail('Запись не найдена или срок хранения истёк',404);
  if(method==='DELETE'){if(r.owner!==uid)fail('Удалить запись может её автор',403);await bucket.delete(r.id);await db.prepare('DELETE FROM recordings WHERE id=?').bind(r.id).run();return json({ok:true})}
  if(method==='GET'){const obj=await bucket.get(r.id,{range:request.headers});if(!obj)fail('Файл не найден',404);const h=new Headers({'Content-Type':'video/webm','Accept-Ranges':'bytes','Cache-Control':'private,no-store'});if(obj.range){h.set('Content-Range',`bytes ${obj.range.offset}-${obj.range.offset+obj.range.length-1}/${obj.size}`);h.set('Content-Length',String(obj.range.length))}else h.set('Content-Length',String(obj.size));return new Response(obj.body,{status:obj.range?206:200,headers:h})}
 }
 fail('Действие не найдено',404);
 }catch(e){if(!e.status)console.error(e);return json({error:e.status?e.message:'Не удалось выполнить действие. Попробуйте ещё раз.'},e.status||500)}
}

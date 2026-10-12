import {handle} from './service.mjs';
const cookieName='pm_session';
const encoder=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
async function hash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));}
function same(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function cookie(request,value,age){return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
async function limited(db,key,limit){const now=Date.now(),window=600000;await db.prepare('INSERT INTO auth_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END').bind(key,now+window,now,now).run();const r=await db.prepare('SELECT count FROM auth_limits WHERE key=?').bind(key).first();return r.count>limit;}
export async function authenticatedHandle(request,db,bucket){try{
 const url=new URL(request.url),path=url.pathname,now=Date.now();
 if(request.method!=='GET'&&(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))return reply({error:'Запрос отклонён'},403);
 const token=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 const tokenHash=token&&/^[a-f0-9]{64}$/.test(token)?await digest(token):null;
 if(path==='/api/auth/logout'&&request.method==='POST'){if(tokenHash)await db.prepare('DELETE FROM sessions WHERE token=?').bind(tokenHash).run();return reply({ok:true},200,{'Set-Cookie':cookie(request,'',0)});}
 if(['/api/auth/login','/api/auth/register'].includes(path)&&request.method==='POST'){
  // Limit both network and account attempts before password derivation.
  const ip=await digest(request.headers.get('CF-Connecting-IP')||'local');
  if(await limited(db,'ip:'+ip,40))return reply({error:'Слишком много попыток. Повторите через 10 минут.'},429);
  const raw=await request.text();if(raw.length>4096)return reply({error:'Слишком большой запрос'},413);
  let b;try{b=JSON.parse(raw)}catch{return reply({error:'Проверьте поля'},400)}
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({error:'Введите email и пароль длиной от 10 до 128 символов'},400);
  if(await limited(db,'email:'+await digest(email),12))return reply({error:'Слишком много попыток. Повторите через 10 минут.'},429);
  let account=await db.prepare('SELECT * FROM accounts WHERE email=?').bind(email).first();
  if(path.endsWith('/register')){
   if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||!['teacher','student'].includes(b.role))return reply({error:'Укажите имя и роль'},400);
   if(account)return reply({error:'Не удалось зарегистрироваться с этим email. Попробуйте войти.'},409);
   const id=crypto.randomUUID(),salt=random(),password=await hash(b.password,salt);
   try{await db.batch([db.prepare('INSERT INTO users(id,name,role,created) VALUES(?,?,?,?)').bind(id,b.name.trim(),b.role,now),db.prepare('INSERT INTO accounts(email,user,salt,password) VALUES(?,?,?,?)').bind(email,id,salt,password)])}catch(e){if(String(e).includes('UNIQUE'))return reply({error:'Не удалось зарегистрироваться с этим email. Попробуйте войти.'},409);throw e}
   account={user:id};
   if(b.role==='teacher')await seedMeetings(db,id);
  }else{
   const value=await hash(b.password,account?.salt||'0000000000000000000000000000000000000000000000000000000000000000');
   if(!account||!same(value,account.password))return reply({error:'Неверный email или пароль'},401);
  }
  const fresh=random();await db.batch([db.prepare('DELETE FROM sessions WHERE expires<=?').bind(now),db.prepare('DELETE FROM auth_limits WHERE expires<=?').bind(now),db.prepare('INSERT INTO sessions(token,user,expires) VALUES(?,?,?)').bind(await digest(fresh),account.user,now+7*86400000)]);
  return reply({ok:true},path.endsWith('/register')?201:200,{'Set-Cookie':cookie(request,fresh,604800)});
 }
 if(path==='/api/register')return reply({error:'Используйте форму регистрации'},404);
 const session=tokenHash?await db.prepare('SELECT user FROM sessions WHERE token=? AND expires>?').bind(tokenHash,now).first():null;
 return handle(request,db,bucket,session?{userId:session.user}:null);
 }catch(e){console.error(e);return reply({error:'Не удалось выполнить действие. Попробуйте ещё раз.'},500)}}
async function seedMeetings(db,uid){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qyzylorda',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const titles=['Защита информации от вредоносного программного обеспечения','Основы языка программирования Go','Разработка мобильных приложений на Kotlin'];await db.batch(titles.map((title,i)=>db.prepare('INSERT OR IGNORE INTO meetings(id,owner,title,date,time,kind,duration,room,created) VALUES(?,?,?,?,?,?,?,?,?)').bind('initial-'+i,uid,title,day,['10:00','12:00','15:00'][i],i===1?'Практика':'Лекция',i===1?90:50,'PlantMeet'+crypto.randomUUID().replaceAll('-',''),Date.now())))}

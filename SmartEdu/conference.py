import math
import secrets
import time

def install(c):
    c.execute("""CREATE TABLE IF NOT EXISTS meetings(id INTEGER PRIMARY KEY,title TEXT,room TEXT,minutes INTEGER,prompt TEXT,active INTEGER,seconds REAL DEFAULT 0,last REAL DEFAULT 0,response TEXT DEFAULT '',score INTEGER,note TEXT DEFAULT '')""")

def snapshot(c):
    return [dict(m) for m in c.execute('SELECT * FROM meetings ORDER BY id DESC')]

def activity(c,action,b,role,ai):
    if action in ('open','end','edit') and role!='teacher': raise ValueError('Бұл әрекет оқытушыға қолжетімді.')
    if action in ('pulse','answer','leave') and role!='student':raise ValueError('Бұл әрекет студентке қолжетімді.')
    if action=='open':
        title=str(b['title']).strip()[:120]; prompt=str(b['prompt']).strip()[:500]; minutes=int(b['minutes'])
        if not title or not prompt or not 1<=minutes<=180:raise ValueError('Сабақ атауын, ұзақтығын және сұрақты енгізіңіз.')
        c.execute("INSERT INTO meetings(title,room,minutes,prompt,active) VALUES(?,?,?,?,1)",(title,'SmartEdu'+secrets.token_hex(16),minutes,prompt))
        return
    m=c.execute('SELECT * FROM meetings WHERE id=?',(b['id'],)).fetchone()
    if not m:raise ValueError('Сабақ табылмады.')
    now=time.time()
    if action=='edit':
        score=int(b['score'])
        if not 0<=score<=10:raise ValueError('Балл 0–10 аралығында болуы керек.')
        c.execute('UPDATE meetings SET score=?,note=? WHERE id=? AND active=0',(score,'Оқытушы түзетті.',m['id']));return
    if not m['active']:raise ValueError('Сабақ аяқталды.')
    elapsed=now-m['last']
    delta=elapsed if m['last'] and 0<elapsed<=35 else 0
    if action in ('pulse','leave'):
        c.execute('UPDATE meetings SET seconds=seconds+?,last=? WHERE id=?',(delta,now if action=='pulse' else 0,m['id']))
    elif action=='answer':
        if not m['last'] or elapsed>35:raise ValueError('Алдымен конференцияға кіріңіз.')
        response=str(b['answer']).strip()[:2000]
        if not response:raise ValueError('Жауап енгізіңіз.')
        c.execute('UPDATE meetings SET response=? WHERE id=?',(response,m['id']))
    elif action=='end':
        seconds=m['seconds']+delta
        presence=min(6,round(6*seconds/(m['minutes']*60)))
        participation=0;reason='Жауап тіркелмеді.'
        if m['response']:
            import json
            raw=ai('Сабақ сұрағы: '+m['prompt']+'\nСтудент жауабы: '+m['response']+'\nЖауаптың сұраққа қатысы мен толықтығын 0–4 баллмен бағала. Тек JSON бер: {"points":2,"reason":"бір сөйлем"}')
            try:
                result=json.loads(raw[raw.index('{'):raw.rindex('}')+1]);points=result['points']
                if type(points)!=int or not 0<=points<=4:raise ValueError()
                participation=points;reason='ЖИ ұсынысы: '+str(result['reason'])[:400]
            except (ValueError,KeyError,TypeError):
                participation=1;reason='Жауап тіркелгені үшін 1 балл. Мазмұнын оқытушы бағалайды.'
        note=f'Байланыста болған уақыт: {int(seconds)//60} мин {int(seconds)%60} сек · {presence}/6. Сұраққа жауап: {participation}/4. '+reason
        c.execute('UPDATE meetings SET active=0,last=0,seconds=?,score=?,note=? WHERE id=? AND active=1',(seconds,presence+participation,note,m['id']))
    else:raise ValueError()

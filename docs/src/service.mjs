import {saveRemoteMeeting,deleteRemoteMeeting} from './cloud.mjs?v=roster-20261103';
import {db,session} from './data.mjs?v=roster-20261103';import {validate} from './validation.mjs?v=roster-20261103';
export async function saveMeeting(v,id){if(session.user?.role!=='teacher')throw Error('Создание доступно преподавателю');const errors=validate(v,'meeting');if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);return saveRemoteMeeting(v,id)}
export async function deleteMeeting(id){return deleteRemoteMeeting(id)}
export function queryMeetings(q='',kind='',sort='asc'){return db.meetings.filter(m=>(session.user?.role==='teacher'||((m.group||'ИС-24А')===(session.user?.group||'ИС-24А')&&(!m.subgroup||m.subgroup==='Вся группа'||m.subgroup===session.user?.subgroup)))&&(m.title+' '+m.teacher).toLocaleLowerCase().includes(q.toLocaleLowerCase())&&(!kind||m.kind===kind)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)*(sort==='desc'?-1:1))}
export function ownRecords(){return db.records.filter(r=>r.owner===session.user?.id)}
export function deleteRecord(id){const i=db.records.findIndex(r=>r.id===id&&r.owner===session.user?.id);if(i<0)throw Error('Запись не найдена');db.records.splice(i,1)}

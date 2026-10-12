import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'PlantMeet | Учебные конференции',description:'Общее расписание и учебные видеовстречи преподавателей и студентов',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}

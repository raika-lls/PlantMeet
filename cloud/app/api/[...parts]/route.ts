import {env} from 'cloudflare:workers';
import {authenticatedHandle} from '../../../lib/auth.mjs';
export const dynamic='force-dynamic';
async function route(request:Request){return authenticatedHandle(request,env.DB,env.BUCKET);}
export {route as GET,route as POST,route as DELETE};

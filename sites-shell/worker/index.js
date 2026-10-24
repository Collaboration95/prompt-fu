export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/config'){
   if(request.method!=='GET')return new Response('Method not allowed',{status:405});
   try{const u=new URL(env.BACKEND_URL);if(!['https:','http:'].includes(u.protocol))throw Error();u.protocol=u.protocol==='https:'?'wss:':'ws:';u.pathname='/ws';u.search='';u.hash='';return Response.json({ws:u.href},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Backend URL is not configured'},{status:503});}
  }
  if(path==='/api/fighter'||path==='/api/arena'){
   if(request.method!=='POST')return new Response('Method not allowed',{status:405});
   if(!env.BACKEND_URL||!env.BACKEND_TOKEN)return Response.json({error:'Backend is not configured'},{status:503});
   try{
    const upstream=await fetch(new URL(path,env.BACKEND_URL),{method:'POST',headers:{'Content-Type':'application/json','x-backend-token':env.BACKEND_TOKEN},body:await request.text(),signal:AbortSignal.timeout(90000),redirect:'manual'});
    if(upstream.status>=300&&upstream.status<400)return Response.json({error:'Backend returned a redirect'},{status:502});
    return new Response(upstream.body,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('Content-Type')||'application/json','Cache-Control':'no-store'}});
   }catch{return Response.json({error:'Backend unavailable or generation timed out'},{status:502});}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const asset=assets[path==='/'?'/index.html':path];if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset[0],'Cache-Control':'no-cache'}});
 }
};

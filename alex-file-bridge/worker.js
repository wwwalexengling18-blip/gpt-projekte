const BASE_HEADERS={"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Cache-Control":"no-store"};
const ALLOWED=new Set(["zip","7z","rar","tar","gz","bz2","xz","mp4","mkv","mov","webm","avi","m4v","pdf","txt","json","csv","jpg","jpeg","png","webp","gif","avif","bmp"]);
function headers(extra={}){return new Headers({...BASE_HEADERS,...extra})}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:headers({"Content-Type":"application/json; charset=utf-8"})})}
function cleanName(v){let n=decodeURIComponent(v||"").replace(/[\\/]/g,"_").replace(/[^a-zA-Z0-9._() -]/g,"_");if(!n||n.length>180||n.includes(".."))return null;let ext=n.includes(".")?n.split(".").pop().toLowerCase():"";return ALLOWED.has(ext)?n:null}
function token(){const a=new Uint8Array(24);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join("")}
function keyFor(name){return Date.now()+"-"+crypto.randomUUID()+"-"+name}
export default{async fetch(req,env){
 const u=new URL(req.url);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers({"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,HEAD,OPTIONS,POST,DELETE","Access-Control-Allow-Headers":"Content-Type,X-Filename,X-Content-Type"})});
 if(u.pathname==="/api/upload"&&req.method==="POST"){
   const name=cleanName(req.headers.get("X-Filename")); if(!name)return json({error:"Unsupported filename or extension"},400);
   const type=req.headers.get("X-Content-Type")||"application/octet-stream"; const key=keyFor(name); const del=token();
   await env.BUCKET.put(key,req.body,{httpMetadata:{contentType:type},customMetadata:{originalName:name,deleteToken:del}});
   return json({name,contentType:type,direct:u.origin+"/f/"+encodeURIComponent(key),view:u.origin+"/v/"+encodeURIComponent(key),deleteUrl:u.origin+"/api/delete/"+encodeURIComponent(key)+"/"+del});
 }
 if(u.pathname==="/api/upload-url"&&req.method==="POST"){
   let b;try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
   if(!/^https:\/\//i.test(b?.url||""))return json({error:"HTTPS only"},400);
   const r=await fetch(b.url,{redirect:"follow"});if(!r.ok)return json({error:"Source could not be fetched"},502);
   let name;try{name=cleanName(new URL(b.url).pathname.split("/").pop())}catch{}
   if(!name)return json({error:"Could not determine a supported filename"},400);
   const type=r.headers.get("content-type")||"application/octet-stream",key=keyFor(name),del=token();
   await env.BUCKET.put(key,r.body,{httpMetadata:{contentType:type},customMetadata:{originalName:name,deleteToken:del}});
   return json({name,contentType:type,direct:u.origin+"/f/"+encodeURIComponent(key),view:u.origin+"/v/"+encodeURIComponent(key),deleteUrl:u.origin+"/api/delete/"+encodeURIComponent(key)+"/"+del});
 }
 if((u.pathname.startsWith("/f/")||u.pathname.startsWith("/v/"))&&(req.method==="GET"||req.method==="HEAD")){
   const obj=await env.BUCKET.get(decodeURIComponent(u.pathname.slice(3)));if(!obj)return new Response("Not found",{status:404,headers:headers()});
   const inline=u.pathname.startsWith("/v/");const h=headers({"Content-Type":obj.httpMetadata?.contentType||"application/octet-stream","Content-Length":String(obj.size),"Accept-Ranges":"bytes","Content-Disposition":inline?"inline":`attachment; filename="${(obj.customMetadata?.originalName||"file").replaceAll('"',"")}"`});
   return new Response(req.method==="HEAD"?null:obj.body,{status:200,headers:h});
 }
 if(u.pathname.startsWith("/api/delete/")&&req.method==="DELETE"){
   const p=u.pathname.split("/");if(p.length<5)return new Response("Not found",{status:404,headers:headers()});
   const key=decodeURIComponent(p[3]),del=p[4],obj=await env.BUCKET.head(key);
   if(!obj||obj.customMetadata?.deleteToken!==del)return new Response("Forbidden",{status:403,headers:headers()});
   await env.BUCKET.delete(key);return json({ok:true});
 }
 const asset=await env.ASSETS.fetch(req);const h=new Headers(asset.headers);for(const [k,v] of Object.entries(BASE_HEADERS))h.set(k,v);return new Response(asset.body,{status:asset.status,headers:h});
}};
const BASE_HEADERS={
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY",
  "Referrer-Policy":"no-referrer",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Cache-Control":"no-store"
};

const ALLOWED=new Set(["zip","7z","rar","tar","gz","bz2","xz","mp4","mkv","mov","webm","avi","m4v","pdf","txt","json","csv","jpg","jpeg","png","webp"]);

function safeName(value){
  const name=decodeURIComponent(value||"").replace(/^\/+/, "");
  if(!name||name.length>240||name.includes("..")||name.includes("\\\\")||name.includes("\0")) return null;
  const ext=name.includes(".")?name.split(".").pop().toLowerCase():"";
  if(!ALLOWED.has(ext)) return null;
  return name;
}
function hdr(extra={}){return new Headers({...BASE_HEADERS,...extra})}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:hdr({"Content-Type":"application/json; charset=utf-8"})})}
function authorized(req,env){
  const value=req.headers.get("Authorization")||"";
  return value.startsWith("Bearer ") && value.slice(7)===env.ADMIN_TOKEN;
}

export default{
  async fetch(req,env){
    const url=new URL(req.url);

    if(url.pathname.startsWith("/f/")){
      const name=safeName(url.pathname.slice(3));
      if(!name) return new Response("Not found",{status:404,headers:hdr()});
      const obj=await env.BUCKET.get(name);
      if(!obj) return new Response("Not found",{status:404,headers:hdr()});
      return new Response(obj.body,{
        headers:hdr({
          "Content-Type":obj.httpMetadata?.contentType||"application/octet-stream",
          "Content-Disposition":`attachment; filename="${name.replaceAll('"',"")}"`,
          "Content-Length":String(obj.size),
          "Accept-Ranges":"bytes"
        })
      });
    }

    if(url.pathname.startsWith("/v/")){
      const name=safeName(url.pathname.slice(3));
      if(!name) return new Response("Not found",{status:404,headers:hdr()});
      const obj=await env.BUCKET.get(name);
      if(!obj) return new Response("Not found",{status:404,headers:hdr()});
      return new Response(obj.body,{
        headers:hdr({
          "Content-Type":obj.httpMetadata?.contentType||"application/octet-stream",
          "Content-Disposition":"inline",
          "Content-Length":String(obj.size),
          "Accept-Ranges":"bytes"
        })
      });
    }

    if(url.pathname==="/api/files" && req.method==="GET"){
      const result=await env.BUCKET.list({limit:1000});
      return json({files:result.objects.map(o=>({key:o.key,size:o.size,uploaded:o.uploaded}))});
    }

    if(url.pathname.startsWith("/api/upload/") && req.method==="PUT"){
      if(!authorized(req,env)) return json({error:"Unauthorized"},401);
      const name=safeName(url.pathname.slice("/api/upload/".length));
      if(!name) return json({error:"Invalid file name or type"},400);
      const contentType=req.headers.get("Content-Type")||"application/octet-stream";
      await env.BUCKET.put(name,req.body,{httpMetadata:{contentType}});
      return json({ok:true,key:name,directUrl:`${url.origin}/f/${encodeURIComponent(name)}`});
    }

    if(url.pathname.startsWith("/api/files/") && req.method==="DELETE"){
      if(!authorized(req,env)) return json({error:"Unauthorized"},401);
      const name=safeName(url.pathname.slice("/api/files/".length));
      if(!name) return json({error:"Invalid file name"},400);
      await env.BUCKET.delete(name);
      return json({ok:true});
    }

    const asset=await env.ASSETS.fetch(req);
    const h=new Headers(asset.headers);
    for(const [k,v] of Object.entries(BASE_HEADERS)) h.set(k,v);
    return new Response(asset.body,{status:asset.status,headers:h});
  }
};
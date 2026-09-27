/* BEACN Koios CORS mirror. Restored for NFT-Studio, 2026-09-27. */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";
    const cors = {"Access-Control-Allow-Origin": origin,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":request.headers.get("Access-Control-Request-Headers") || "Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin, Access-Control-Request-Headers"};
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
    if (!["GET","HEAD","POST"].includes(request.method)) return new Response("Method not allowed",{status:405,headers:cors});
    let path = url.pathname.replace(/\/+/g,"/");
    let base = "https://api.koios.rest";
    if (path === "/preview" || path.startsWith("/preview/")) {base="https://preview.koios.rest";path=path.slice(8)||"/";}
    path=path.replace(/^\/api\/v1\/api\/v1(?=\/|$)/,"/api/v1");
    if (!path.startsWith("/api/v1/") && path !== "/api/v1") path="/api/v1"+path;
    const headers=new Headers();
    for (const name of ["content-type","accept","prefer","range","range-unit"]) {const value=request.headers.get(name);if(value)headers.set(name,value);}
    if(request.method==="POST"&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
    try {
      const response=await fetch(base+path+url.search,{method:request.method,headers,body:request.method==="POST"?await request.arrayBuffer():undefined,redirect:"manual",signal:AbortSignal.timeout(15000)});
      const out=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors))out.set(key,value);
      out.set("Cache-Control","no-store");
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers:out});
    } catch (error) {console.error(error.message); return new Response("Koios upstream unavailable",{status:502,headers:cors});}
  }
};

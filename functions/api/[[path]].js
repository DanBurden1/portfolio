const ITERATIONS = 310000;
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const MAX_BODY = 1_000_000;
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const fail = (message,status=400) => json({error:message},status);
const bytes = n => crypto.getRandomValues(new Uint8Array(n));
const hex = a => [...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const b64url = a => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function sha(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
async function passwordHash(password,salt,iterations){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return b64url(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,256));}
const cookieName='db_session';
function getCookie(req){const c=req.headers.get('Cookie')||'';const m=c.match(new RegExp('(?:^|;\\s*)'+cookieName+'=([^;]+)'));return m?m[1]:'';}
function cookie(value,maxAge){return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
function clearCookie(){return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;}
async function body(req){const len=Number(req.headers.get('Content-Length')||0);if(len>MAX_BODY)throw new Error('Request is too large.');return req.json();}
function validEmail(s){return typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);}
function cleanText(v,max=3000){if(typeof v!=='string')throw new Error('Invalid text value.');const s=v.trim();if(s.length>max)throw new Error('One of the fields is too long.');return s;}
function safeHttpUrl(v){if(!v)return '';if(typeof v!=='string'||v.length>1000)throw new Error('Invalid URL.');const u=new URL(v);if(!['https:','http:'].includes(u.protocol))throw new Error('Only HTTP and HTTPS links are allowed.');return u.href;}
function safeImageUrl(v){if(!v)return '';if(typeof v==='string'&&/^\/api\/media\/uploads\/[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(v))return v;return safeHttpUrl(v);}
async function admin(req,env){const token=getCookie(req);if(!token)return null;const hash=await sha(token);const row=await env.DB.prepare('SELECT admins.id, admins.email FROM sessions JOIN admins ON admins.id=sessions.admin_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(hash,Math.floor(Date.now()/1000)).first();return row||null;}
function originOk(req,env){const origin=req.headers.get('Origin');if(!origin)return false;let expected=env.SITE_ORIGIN;try{if(expected)return new URL(origin).origin===new URL(expected).origin;return new URL(origin).host===new URL(req.url).host;}catch{return false;}}
async function requireAdmin(req,env){const user=await admin(req,env);return user;}
async function settings(env){const rows=await env.DB.prepare('SELECT key,value FROM site_settings').all();return Object.fromEntries(rows.results.map(r=>[r.key,r.value]));}
async function content(env){const s=await settings(env);let socials=[];try{socials=JSON.parse(s.socials||'[]');}catch{}const projects=await env.DB.prepare('SELECT id,title,category,description,image_url,project_url,sort_order FROM projects ORDER BY sort_order,id').all();return {settings:s,socials,projects:projects.results};}
async function handle(req,env,ctx){
  if(!env.DB)return fail('The D1 database binding (DB) is not configured.',503);
  const url=new URL(req.url), parts=url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent), route=parts.join('/'), method=req.method;
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{'Allow':'GET,POST,PUT,DELETE,OPTIONS'}});
  if(['POST','PUT','DELETE'].includes(method)&&!originOk(req,env))return fail('Request origin could not be verified.',403);
  if(method==='GET'&&parts[0]==='media'&&parts[1]==='uploads'&&env.MEDIA){
    const key=parts.slice(1).join('/');
    const object=await env.MEDIA.get(key);
    if(!object)return fail('Image not found.',404);
    const headers=new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control','public, max-age=31536000, immutable');
    headers.set('X-Content-Type-Options','nosniff');
    return new Response(object.body,{headers});
  }
  if(method==='GET'&&route==='status'){const a=await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first();const user=await admin(req,env);return json({admin_exists:a.n>0,authenticated:!!user});}
  if(method==='GET'&&route==='content')return json(await content(env));
  if(method==='POST'&&route==='setup'){
    if(!env.SETUP_TOKEN)return fail('Administrator setup is disabled. Add the SETUP_TOKEN secret first.',503);
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first();if(count.n>0)return fail('An administrator already exists.',409);
    const data=await body(req);if(data.token!==env.SETUP_TOKEN)return fail('The setup token is incorrect.',403);
    if(!validEmail(data.email)||typeof data.password!=='string'||data.password.length<12||data.password.length>200)return fail('Enter a valid email and a password of at least 12 characters.');
    const salt=bytes(16),hash=await passwordHash(data.password,salt,ITERATIONS),id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO admins(id,email,password_hash,password_salt,password_iterations) VALUES(?,?,?,?,?)').bind(id,data.email.trim().toLowerCase(),hash,b64url(salt),ITERATIONS).run();
    return json({ok:true});
  }
  if(method==='POST'&&route==='login'){
    const data=await body(req);if(!validEmail(data.email)||typeof data.password!=='string'||data.password.length>200)return fail('Email or password is incorrect.',401);
    const ip=await sha(req.headers.get('CF-Connecting-IP')||'unknown');const now=Math.floor(Date.now()/1000);
    const attempt=await env.DB.prepare('SELECT attempts,window_started,blocked_until FROM login_attempts WHERE ip_hash=?').bind(ip).first();
    if(attempt&&attempt.blocked_until>now)return fail('Too many attempts. Please wait 15 minutes before trying again.',429);
    const user=await env.DB.prepare('SELECT * FROM admins WHERE email=?').bind(data.email.trim().toLowerCase()).first();
    const salt=user?Uint8Array.from(atob(user.password_salt.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)):bytes(16);
    const computed=await passwordHash(data.password,salt,user?.password_iterations||ITERATIONS);
    const valid=!!user&&computed===user.password_hash;
    if(!valid){
      const within=attempt&&now-attempt.window_started<900;const n=within?attempt.attempts+1:1;const blocked=n>=8?now+900:0;
      await env.DB.prepare('INSERT INTO login_attempts(ip_hash,attempts,window_started,blocked_until) VALUES(?,?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=excluded.attempts,window_started=excluded.window_started,blocked_until=excluded.blocked_until').bind(ip,n,within?attempt.window_started:now,blocked).run();
      return fail('Email or password is incorrect.',401);
    }
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(ip).run();
    const token=b64url(bytes(32)),tokenHash=await sha(token),expires=now+SESSION_SECONDS;
    await env.DB.prepare('INSERT INTO sessions(token_hash,admin_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash,user.id,expires,now).run();
    return json({ok:true},200,{'Set-Cookie':cookie(token,SESSION_SECONDS)});
  }
  if(method==='POST'&&route==='logout'){
    const token=getCookie(req);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(token)).run();
    return json({ok:true},200,{'Set-Cookie':clearCookie()});
  }
  const user=await requireAdmin(req,env);
  if(['PUT','POST','DELETE'].includes(method)){
    if(!user && !['setup','login','logout'].includes(route))return fail('Please sign in again.',401);
  }
  if(method==='GET'&&route==='projects'){const rows=await env.DB.prepare('SELECT id,title,category,description,image_url,project_url,sort_order FROM projects ORDER BY sort_order,id').all();return json({projects:rows.results});}
  if(method==='PUT'&&route==='content'){
    const d=await body(req),s=d.settings||{};const allowed={eyebrow:100,hero_title:180,hero_intro:500,about_title:120,about_text:3000,contact_title:150,contact_text:500,location:100,email:254};
    if(!validEmail(s.email))return fail('Enter a valid contact email.');
    const statements=Object.entries(allowed).map(([k,max])=>env.DB.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,cleanText(s[k]??'',max)));
    const socials=Array.isArray(d.socials)?d.socials.slice(0,12).map(x=>({label:cleanText(x.label||'',40),url:safeHttpUrl(x.url||'')})):[];
    statements.push(env.DB.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('socials',JSON.stringify(socials)));
    await env.DB.batch(statements);return json({ok:true});
  }
  if(method==='POST'&&route==='projects'){
    const d=await body(req);const title=cleanText(d.title,120);if(!title)return fail('Project title is required.');
    const max=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) AS n FROM projects').first();
    await env.DB.prepare('INSERT INTO projects(id,title,category,description,image_url,project_url,sort_order) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),title,cleanText(d.category||'',100),cleanText(d.description||'',1200),safeImageUrl(d.image_url||''),safeHttpUrl(d.project_url||''),max.n+1).run();return json({ok:true});
  }
  if(method==='PUT'&&route==='projects/reorder'){
    const d=await body(req);if(!Array.isArray(d.ids)||d.ids.length>100)return fail('Invalid project order.');
    const existing=await env.DB.prepare('SELECT id FROM projects').all();const ids=existing.results.map(x=>x.id);
    if(d.ids.length!==ids.length||!d.ids.every(id=>ids.includes(id))||new Set(d.ids).size!==ids.length)return fail('Project order does not match saved projects.');
    await env.DB.batch(d.ids.map((id,i)=>env.DB.prepare('UPDATE projects SET sort_order=? WHERE id=?').bind(i+1,id)));return json({ok:true});
  }
  if(parts[0]==='projects'&&parts.length===2&&method==='PUT'){
    const d=await body(req);const title=cleanText(d.title,120);if(!title)return fail('Project title is required.');
    await env.DB.prepare('UPDATE projects SET title=?,category=?,description=?,image_url=?,project_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(title,cleanText(d.category||'',100),cleanText(d.description||'',1200),safeImageUrl(d.image_url||''),safeHttpUrl(d.project_url||''),parts[1]).run();return json({ok:true});
  }
  if(parts[0]==='projects'&&parts.length===2&&method==='DELETE'){await env.DB.prepare('DELETE FROM projects WHERE id=?').bind(parts[1]).run();return json({ok:true});}
  if(method==='POST'&&route==='upload'){
    if(!env.MEDIA)return fail('Image uploads are not enabled yet. Add the optional R2 bucket binding named MEDIA.',503);
    const form=await req.formData(),file=form.get('image');if(!file||typeof file==='string')return fail('Choose an image to upload.');
    if(file.size>5*1024*1024)return fail('Images must be 5 MB or smaller.');
    const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};if(!types[file.type])return fail('Use a JPEG, PNG, WebP or GIF image.');
    const key=`uploads/${crypto.randomUUID()}.${types[file.type]}`;await env.MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=31536000, immutable'}});
    return json({ok:true,url:`${url.origin}/api/media/${key}`});
  }
  return fail('Not found.',404);
}
export async function onRequest(context){try{return await handle(context.request,context.env,context);}catch(e){return json({error:e?.message==='Unexpected end of JSON input'?'Invalid request body.':'The request could not be completed. Please check your input and configuration.'},500);}}

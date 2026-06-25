import { createClient } from "@supabase/supabase-js";
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.BASE || "http://localhost:3100";
const ref = new URL(SUPA_URL).hostname.split(".")[0];
const NAME = `sb-${ref}-auth-token`;
const toCookies = (s) => {
  const raw = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const enc = encodeURIComponent(raw);
  if (enc.length <= 3180) return [[NAME, raw]];
  const out = []; let e = enc;
  while (e.length > 0) { const h = e.slice(0,3180); out.push(decodeURIComponent(h)); e = e.slice(h.length); }
  return out.map((v,i)=>[`${NAME}.${i}`, v]);
};
const hdr = (m) => [...m].map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("; ");
const apply = (m, arr) => { for (const s of arr){ const [p]=s.split(";"); const i=p.indexOf("="); const n=p.slice(0,i).trim(); const v=decodeURIComponent(p.slice(i+1).trim()); if(/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(s)) m.delete(n); else m.set(n,v);} };

const sb = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
const { data, error } = await sb.auth.signInWithPassword({ email: "admin@pland.in", password: "PlanDesk#2026" });
if (error) { console.log("mint failed:", error.message); process.exit(1); }
const { data: gu } = await sb.auth.getUser(data.session.access_token);
console.log("sanity: getUser(access_token) →", gu?.user?.email ?? "NULL", "| chunks:", toCookies(data.session).length);

async function follow(label, cookies) {
  console.log(`\n${label} — follow jar from / (max 8 hops):`);
  const jar = new Map(cookies);
  let path = "/";
  for (let hop=1; hop<=8; hop++){
    const r = await fetch(`${BASE}${path}`, { headers:{ cookie: hdr(jar) }, redirect:"manual" });
    apply(jar, r.headers.getSetCookie?.() ?? []);
    const loc = r.headers.get("location");
    console.log(`   hop ${hop}: ${path} → ${r.status}${loc? " → "+new URL(loc, BASE).pathname+new URL(loc, BASE).search : " (renders)"}`);
    if (r.status === 200) { console.log("   settled ✓"); return; }
    if (loc) path = new URL(loc, BASE).pathname; else return;
  }
  console.log("   *** STILL REDIRECTING after 8 hops = INFINITE LOOP ✗ ***");
}

await follow("VALID session", toCookies(data.session));
const stale = { ...data.session, expires_at: Math.floor(Date.now()/1000)-60, expires_in: 0 };
await follow("STALE session (forces refresh)", toCookies(stale));

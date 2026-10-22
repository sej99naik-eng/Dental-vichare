/* Vichare Dental – shared data layer for the clinic app (index.html) and the admin app (admin.html).
   Cloud mode: Firebase sign-in + Firestore, so every authorised device sees the same records.
   Local mode: when firebase-config.js is left empty, records stay in this browser only. */
(function(){
"use strict";
const VDC = window.VDC = {};
const CFG = window.VDC_FIREBASE_CONFIG;
VDC.cloud = !!(CFG && CFG.apiKey && CFG.projectId && window.firebase);
VDC.CLINIC = { name:"Vichare Dental Clinic", tz:"+05:30" };

/* ---------- small helpers ---------- */
const isoOf = d => { const z = new Date(d.getTime() - d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
VDC.todayISO = () => isoOf(new Date());
VDC.addDays = (iso, n) => { const d = new Date(iso + "T00:00"); d.setDate(d.getDate() + n); return isoOf(d); };
VDC.addMonths = (iso, n) => { const d = new Date(iso + "T00:00"), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); d.setDate(Math.min(day, last)); return isoOf(d); };
VDC.rupees = n => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
VDC.newId = (prefix = "") => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
VDC.esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
VDC.fmtDate = iso => { if(!iso) return "—"; const d = new Date(iso.length===10 ? iso+"T00:00" : iso); return isNaN(d) ? "—" : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); };
VDC.fmtTime = t => { if(!t) return ""; const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; return `${((h+11)%12)+1}:${String(m).padStart(2,"0")} ${ap}`; };
const clean = o => JSON.parse(JSON.stringify(o, (k, v) => v === undefined ? null : v));
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function deepMerge(a, b){ const out = { ...(a||{}) }; for(const [k, v] of Object.entries(b||{})) out[k] = isObj(v) && isObj(out[k]) && !("__inc" in v) ? deepMerge(out[k], v) : v; return out; }
function setPath(obj, path, val){ const keys = path.split("."); let o = obj; keys.slice(0,-1).forEach(k => { if(!isObj(o[k])) o[k] = {}; o = o[k]; });
  const last = keys[keys.length-1]; o[last] = val && typeof val === "object" && "__inc" in val ? (Number(o[last]) || 0) + val.__inc : val; }
function matches(row, where){ if(!where) return true; const list = Array.isArray(where[0]) ? where : [where];
  return list.every(([f, op, v]) => { const x = f.split(".").reduce((o,k)=> o == null ? undefined : o[k], row);
    return op==="==" ? x===v : op===">=" ? x>=v : op==="<=" ? x<=v : op===">" ? x>v : op==="<" ? x<v : op==="in" ? v.includes(x) : false; }); }

/* ---------- local store (IndexedDB, this browser only) ---------- */
function localStore(){
  let dbp = null;
  const STORES = ["consents","appointments","payments","meta","staff"];
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open("vichare-dental", 2);
    r.onupgradeneeded = () => { const d = r.result; if(!d.objectStoreNames.contains("patients")) d.createObjectStore("patients", { keyPath:"_id" });
      STORES.forEach(n => { if(!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const run = async (name, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(name, mode); let out; const st = t.objectStore(name);
    out = fn(st); t.oncomplete = () => res(out && "result" in out ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  async function all(name){ const d = await open(); return new Promise((res, rej) => { const rows = []; const t = d.transaction(name, "readonly");
    const rq = t.objectStore(name).openCursor(); rq.onsuccess = () => { const c = rq.result; if(c){ rows.push({ ...c.value, _id:String(c.primaryKey) }); c.continue(); } };
    t.oncomplete = () => res(rows); t.onerror = () => rej(t.error); }); }
  const getOne = async (name, id) => { const v = await run(name, "readonly", st => st.get(id)); return v ? { ...v, _id:id } : null; };
  const putOne = (name, id, data) => run(name, "readwrite", st => { const c = clean(data); delete c._id; return st.keyPath ? st.put({ ...c, _id:id }) : st.put(c, id); });
  const listeners = {};
  const notify = name => { const ls = listeners[name]; if(!ls || !ls.size) return; all(name).then(rows => ls.forEach(l => l.cb(rows.filter(r => matches(r, l.where))))); };
  return {
    mode:"local",
    watch(name, where, cb){ const l = { where, cb }; (listeners[name] = listeners[name] || new Set()).add(l);
      all(name).then(rows => { if(listeners[name].has(l)) cb(rows.filter(r => matches(r, where))); }); return () => listeners[name].delete(l); },
    list: async (name, where) => (await all(name)).filter(r => matches(r, where)),
    get: getOne,
    set: async (name, id, data) => { await putOne(name, id, data); notify(name); return "ok"; },
    merge: async (name, id, data) => { const cur = await getOne(name, id) || {}; await putOne(name, id, deepMerge(cur, clean(data))); notify(name); return "ok"; },
    update: async (name, id, fields) => { const cur = await getOne(name, id); if(!cur) throw new Error("This record no longer exists.");
      for(const [k, v] of Object.entries(fields)) setPath(cur, k, v); await putOne(name, id, cur); notify(name); return "ok"; },
    del: async (name, id) => { await run(name, "readwrite", st => st.delete(id)); notify(name); return "ok"; },
    count: async name => (await all(name)).length,
  };
}

/* ---------- cloud store (Firestore) ---------- */
function cloudStore(fs){
  const conv = d => ({ ...d.data(), _id:d.id });
  const q = (name, where) => { let r = fs.collection(name); if(where) (Array.isArray(where[0]) ? where : [where]).forEach(w => { r = r.where(w[0], w[1], w[2]); }); return r; };
  // Firestore keeps writes on the device when offline and syncs later; don't make people wait for the server.
  const write = p => { const done = p.then(() => "ok"); done.catch(e => VDC.onError && VDC.onError(e));
    return Promise.race([done, new Promise(r => setTimeout(() => r("queued"), 3500))]); };
  const prep = fields => { const f = {}; for(const [k, v] of Object.entries(fields)) f[k] = v && typeof v === "object" && "__inc" in v ? firebase.firestore.FieldValue.increment(v.__inc) : (v === undefined ? null : v); return f; };
  return {
    mode:"cloud",
    watch(name, where, cb){ return q(name, where).onSnapshot(s => cb(s.docs.map(conv)), e => { console.error(e); VDC.onError && VDC.onError(e); }); },
    list: async (name, where) => (await q(name, where).get()).docs.map(conv),
    get: async (name, id) => { const s = await fs.collection(name).doc(id).get(); return s.exists ? conv(s) : null; },
    set: (name, id, data) => { const c = clean(data); delete c._id; return write(fs.collection(name).doc(id).set(c)); },
    merge: (name, id, data) => { const c = clean(data); delete c._id; return write(fs.collection(name).doc(id).set(c, { merge:true })); },
    update: (name, id, fields) => write(fs.collection(name).doc(id).update(prep(fields))),
    del: (name, id) => write(fs.collection(name).doc(id).delete()),
  };
}
VDC.inc = n => ({ __inc:n });

/* ---------- start, sign-in, roles ---------- */
VDC.start = async () => {
  if(VDC.cloud){
    if(!firebase.apps.length) firebase.initializeApp(CFG);
    const fs = firebase.firestore();
    try{ await fs.enablePersistence({ synchronizeTabs:true }); }catch(e){ /* another tab or unsupported browser: works online only */ }
    VDC.fs = fs; VDC.auth = firebase.auth(); VDC.store = cloudStore(fs);
  } else {
    VDC.store = localStore();
  }
  VDC.local = VDC.cloud ? localStore() : VDC.store;   // this browser's own records (used to move old records to the cloud)
  return VDC.store.mode;
};
VDC.onAuth = cb => VDC.auth.onAuthStateChanged(cb);
VDC.signIn = (email, pw) => VDC.auth.signInWithEmailAndPassword(String(email).trim(), pw);
VDC.signOut = () => VDC.auth.signOut();
VDC.resetPassword = email => VDC.auth.sendPasswordResetEmail(String(email).trim());
VDC.profile = async user => {
  try{ const s = await VDC.store.get("staff", user.uid); return s ? { ...s, uid:user.uid, email:user.email } : { none:true }; }
  catch(e){ return { error:e }; }
};
VDC.authMessage = e => {
  const c = (e && e.code) || "";
  if(c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-login")) return "That email and password don't match. Check them and try again.";
  if(c.includes("invalid-email")) return "Enter a valid email address.";
  if(c.includes("too-many-requests")) return "Too many attempts. Wait a few minutes and try again.";
  if(c.includes("network")) return "No internet connection. Connect and try again.";
  if(c.includes("email-already-in-use")) return "An account with this email already exists.";
  if(c.includes("weak-password")) return "Use a password of at least 8 characters.";
  if(c.includes("permission-denied")) return "Your account doesn't have permission to do this.";
  return (e && e.message) || "Something went wrong. Try again.";
};
// First owner: creates the sign-in account, the owner record and their admin staff record in one step.
VDC.setupOwner = async (name, email, pw) => {
  const cred = await VDC.auth.createUserWithEmailAndPassword(String(email).trim(), pw);
  const uid = cred.user.uid, now = new Date().toISOString();
  const b = VDC.fs.batch();
  b.set(VDC.fs.collection("meta").doc("owner"), { uid, createdAt:now });
  b.set(VDC.fs.collection("staff").doc(uid), { name, email:String(email).trim().toLowerCase(), role:"admin", active:true, createdAt:now, createdBy:uid });
  try{ await b.commit(); }
  catch(e){ try{ await cred.user.delete(); }catch{} const err = new Error("This clinic already has an owner. Sign in instead, or ask the owner to add you."); err.code = "owner-exists"; throw err; }
  return uid;
};
VDC.addStaff = async ({ name, email, password, role }) => {
  const sec = firebase.apps.find(a => a.name === "staff-maker") || firebase.initializeApp(CFG, "staff-maker");
  const cred = await sec.auth().createUserWithEmailAndPassword(String(email).trim(), password);
  const uid = cred.user.uid; await sec.auth().signOut();
  await VDC.store.set("staff", uid, { name, email:String(email).trim().toLowerCase(), role, active:true, createdAt:new Date().toISOString(), createdBy:(VDC.me && VDC.me.uid) || "" });
  return uid;
};

/* ---------- payments ---------- */
VDC.MODES = ["Cash","UPI","Card","Bank transfer","Cheque"];
VDC.billing = p => {
  const fees = (p.treatments || []).reduce((s, t) => s + (Number(t.fee) || 0), 0);
  const b = p.billing || {}, discount = Number(b.discount) || 0;
  const payable = Math.max(0, fees - discount), paid = Number(b.paid) || 0;
  const balance = Math.max(0, payable - paid), credit = Math.max(0, paid - payable), today = VDC.todayISO();
  let avail = paid - (Number(b.planStartPaid) || 0);
  const plan = (b.plan || []).slice().sort((x, y) => x.due < y.due ? -1 : x.due > y.due ? 1 : 0).map(r => {
    const amount = Number(r.amount) || 0, cover = Math.max(0, Math.min(amount, avail)); avail -= cover;
    const left = Math.round(amount - cover);
    const status = left <= 0 ? "Paid" : r.due < today ? "Overdue" : r.due === today ? "Due today" : cover > 0 ? "Part paid" : "Upcoming";
    return { ...r, amount, paidAmt:cover, left, status };
  });
  const next = plan.find(r => r.left > 0) || null;
  const overdue = plan.filter(r => r.left > 0 && r.due < today).reduce((s, r) => s + r.left, 0);
  return { fees, discount, payable, paid, balance, credit, plan, next, overdue, planTotal:plan.reduce((s,r)=>s+r.amount,0) };
};
VDC.makePlan = (amount, count, firstDue, every) => {
  amount = Math.round(Number(amount) || 0); count = Math.max(1, Math.min(36, Math.round(Number(count) || 1)));
  const base = Math.floor(amount / count), rows = [];
  for(let i = 0; i < count; i++){
    const due = every === "week" ? VDC.addDays(firstDue, 7*i) : every === "2weeks" ? VDC.addDays(firstDue, 14*i) : VDC.addMonths(firstDue, i);
    rows.push({ id:VDC.newId("in"), due, amount: i === count-1 ? amount - base*(count-1) : base });
  }
  return rows;
};
VDC.receiptNo = () => { const d = new Date(), p = n => String(n).padStart(2,"0"); return `R${String(d.getFullYear()).slice(2)}${p(d.getMonth()+1)}${p(d.getDate())}-${Math.random().toString(36).slice(2,6).toUpperCase()}`; };
// Records a payment and adds it to the patient's paid total.
VDC.recordPayment = async (patient, pay) => {
  const id = VDC.newId("pay");
  const doc = { patientId:patient._id, pid:patient.pid || "", patientName:patient.name || "", phone:patient.phone || "",
    amount:Math.round(Number(pay.amount) || 0), date:pay.date || VDC.todayISO(), mode:pay.mode || "Cash", ref:pay.ref || "", note:pay.note || "",
    receiptNo:VDC.receiptNo(), receivedBy:(VDC.me && VDC.me.name) || "", receivedByUid:(VDC.me && VDC.me.uid) || "", createdAt:new Date().toISOString() };
  await VDC.store.set("payments", id, doc);
  await VDC.store.update("patients", patient._id, { "billing.paid":VDC.inc(doc.amount) });
  return { ...doc, _id:id };
};
VDC.deletePayment = async pay => {
  await VDC.store.del("payments", pay._id);
  await VDC.store.update("patients", pay.patientId, { "billing.paid":VDC.inc(-Math.round(Number(pay.amount) || 0)) });
};
VDC.inWords = num => {
  let n = Math.round(Number(num) || 0); if(n === 0) return "Zero";
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two = x => x < 20 ? a[x] : b[Math.floor(x/10)] + (x % 10 ? " " + a[x % 10] : "");
  const three = x => x >= 100 ? a[Math.floor(x/100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x);
  const out = [], cr = Math.floor(n/1e7); n %= 1e7; const lk = Math.floor(n/1e5); n %= 1e5; const th = Math.floor(n/1000); n %= 1000;
  if(cr) out.push(three(cr) + " Crore"); if(lk) out.push(two(lk) + " Lakh"); if(th) out.push(two(th) + " Thousand"); if(n) out.push(three(n));
  return out.join(" ");
};
VDC.receiptHTML = (pay, patient, logoSrc) => {
  const e = VDC.esc, bl = patient ? VDC.billing(patient) : null;
  const tx = patient ? (patient.treatments || []).map(t => t.type + (t.teeth ? " (" + t.teeth + ")" : "")).join(", ") : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${e(pay.receiptNo)}</title>
<style>body{font-family:Georgia,serif;color:#2a1533;max-width:640px;margin:28px auto;padding:0 18px;line-height:1.5}.top{display:flex;gap:14px;align-items:center;border-bottom:3px solid #7b3fa6;padding-bottom:10px}.top img{width:56px}h1{margin:0;font-weight:400;font-size:24px}small,th{color:#77607f;font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;margin-top:14px}th{text-align:left;font-weight:normal;width:38%;padding:5px 8px 5px 0;vertical-align:top}td{padding:5px 0}.amt{font-size:28px;font-family:Georgia,serif;margin:16px 0 0}.words{font-family:Arial,sans-serif;font-size:13px;color:#77607f}.foot{margin-top:28px;font-family:Arial,sans-serif;font-size:12px;color:#77607f;border-top:1px solid #ead7e7;padding-top:8px}</style></head><body>
<div class="top">${logoSrc ? `<img src="${logoSrc}" alt="">` : ""}<div style="flex:1"><h1>${e(VDC.CLINIC.name)}</h1><small>Payment receipt</small></div><small style="text-align:right">No. ${e(pay.receiptNo)}<br>${VDC.fmtDate(pay.date)}</small></div>
<p class="amt">${VDC.rupees(pay.amount)}</p><div class="words">Rupees ${e(VDC.inWords(pay.amount))} only</div>
<table><tr><th>Received from</th><td>${e(pay.patientName)}${pay.pid ? " · " + e(pay.pid) : ""}</td></tr>
<tr><th>Paid by</th><td>${e(pay.mode)}${pay.ref ? " · Ref " + e(pay.ref) : ""}</td></tr>
${tx ? `<tr><th>Towards</th><td>${e(tx)}</td></tr>` : ""}${pay.note ? `<tr><th>Note</th><td>${e(pay.note)}</td></tr>` : ""}
${bl ? `<tr><th>Total payable</th><td>${VDC.rupees(bl.payable)}</td></tr><tr><th>Paid to date</th><td>${VDC.rupees(bl.paid)}</td></tr><tr><th>Balance</th><td>${VDC.rupees(bl.balance)}</td></tr>` : ""}
<tr><th>Received by</th><td>${e(pay.receivedBy || "—")}</td></tr></table>
<div class="foot">This is a computer-generated receipt from ${e(VDC.CLINIC.name)}.</div></body></html>`;
};

/* ---------- appointments and calendar ---------- */
VDC.APPT_STATUS = ["Scheduled","Arrived","Done","Missed","Cancelled"];
const utcStamp = (date, time, addMin = 0) => { const d = new Date(`${date}T${time || "09:00"}:00${VDC.CLINIC.tz}`); d.setMinutes(d.getMinutes() + addMin);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
const icsText = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = line => { const out = []; let s = line; while(s.length > 72){ out.push(s.slice(0, 72)); s = " " + s.slice(72); } out.push(s); return out.join("\r\n"); };
VDC.icsFor = (appts, reminderMin) => {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Vichare Dental Clinic//OPD//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Vichare Dental OPD"];
  appts.forEach(a => {
    lines.push("BEGIN:VEVENT", `UID:${a._id}@vichare-dental`, `DTSTAMP:${now}`, `DTSTART:${utcStamp(a.date, a.time)}`, `DTEND:${utcStamp(a.date, a.time, Number(a.duration) || 30)}`,
      fold(`SUMMARY:${icsText(`${a.patientName} · ${a.treatment || "Appointment"}`)}`), fold(`LOCATION:${icsText(VDC.CLINIC.name)}`),
      fold(`DESCRIPTION:${icsText([a.pid && "Patient ID: " + a.pid, a.phone && "Phone: " + a.phone, a.dentist && "Dentist: " + a.dentist, a.notes && "Notes: " + a.notes].filter(Boolean).join("\n"))}`));
    if(reminderMin > 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${icsText(`${a.patientName} at ${VDC.fmtTime(a.time)}`)}`), `TRIGGER:-PT${Math.round(reminderMin)}M`, "END:VALARM");
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
};
VDC.gcalLink = a => "https://calendar.google.com/calendar/render?action=TEMPLATE"
  + "&text=" + encodeURIComponent(`${a.patientName} · ${a.treatment || "Appointment"}`)
  + "&dates=" + utcStamp(a.date, a.time) + "/" + utcStamp(a.date, a.time, Number(a.duration) || 30)
  + "&details=" + encodeURIComponent([a.pid && "Patient ID: " + a.pid, a.phone && "Phone: " + a.phone, a.notes].filter(Boolean).join("\n"))
  + "&location=" + encodeURIComponent(VDC.CLINIC.name);

/* ---------- backup ---------- */
const BACKUP_COLLS = ["patients","consents","appointments","payments"];
VDC.exportAll = async (store = VDC.store) => {
  const out = { app:"vichare-dental", version:2, exportedAt:new Date().toISOString() };
  for(const c of BACKUP_COLLS) out[c] = await store.list(c, null);
  return out;
};
VDC.importAll = async (j, store = VDC.store) => {
  if(!j || j.app !== "vichare-dental" || !Array.isArray(j.patients)) throw new Error("This is not a Vichare Dental backup file.");
  let n = 0;
  for(const p of j.patients){ if(p && p._id){ await store.merge("patients", p._id, p); n++; } }
  const consents = Array.isArray(j.consents) ? j.consents : Object.entries(j.consents || {}).map(([k, v]) => ({ ...v, _id:k }));
  for(const c of consents){ if(c && c._id) await store.set("consents", c._id, c); }
  for(const c of ["appointments","payments"]) for(const r of (j[c] || [])){ if(r && r._id) await store.set(c, r._id, r); }
  return n;
};
})();

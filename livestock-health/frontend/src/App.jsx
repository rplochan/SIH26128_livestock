import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const S = {
  Healthy: { dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-300", tile: "bg-emerald-500/10 border-emerald-500/30", panel: "bg-emerald-500/10 border-emerald-500/40", txt: "text-emerald-300" },
  Monitor: { dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-300", tile: "bg-amber-500/10 border-amber-500/30", panel: "bg-amber-500/10 border-amber-500/40", txt: "text-amber-300" },
  "At Risk": { dot: "bg-orange-400", chip: "bg-orange-500/15 text-orange-300", tile: "bg-orange-500/10 border-orange-500/30", panel: "bg-orange-500/10 border-orange-500/40", txt: "text-orange-300" },
  "High Risk": { dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-300", tile: "bg-rose-500/10 border-rose-500/30", panel: "bg-rose-500/10 border-rose-500/40", txt: "text-rose-300" },
  "No data": { dot: "bg-slate-500", chip: "bg-white/10 text-slate-300", tile: "bg-white/5 border-white/10", panel: "bg-white/5 border-white/15", txt: "text-slate-300" },
};
const Chip = ({ l }) => <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${S[l].chip}`}><i className={`w-1.5 h-1.5 rounded-full ${S[l].dot}`} />{l}</span>;
const Source = ({ s }) => <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s === "simulated" ? "bg-violet-500/15 text-violet-300" : "bg-white/10 text-slate-300"}`}>{s === "simulated" ? "Simulated" : "Manual"}</span>;
const input = "w-full bg-[#0c1513] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-emerald-400";
const card = "bg-[#111b18] rounded-2xl border border-white/10";
const link = "text-sm font-medium text-emerald-300 hover:text-emerald-200 underline underline-offset-4";
const Title = ({ children }) => <h2 className="serif text-3xl mb-5">{children}</h2>;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("t"));
  const [view, setView] = useState("dash");
  const [sel, setSel] = useState(null);
  const api = useCallback(async (path, method = "GET", body) => {
    const r = await fetch("/api" + path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) }, body: body && JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(Array.isArray(d.detail) ? d.detail.map((x) => x.msg).join("; ") : d.detail || "Something went wrong. Try again.");
    return d;
  }, [token]);
  if (!token) return <Login api={api} onLogin={(t) => { localStorage.setItem("t", t); setToken(t); }} />;
  return (
    <div className="max-w-3xl mx-auto px-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <span className="serif text-2xl flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />Herd Watch</span>
        <nav className="flex items-center gap-1 text-sm bg-white/5 border border-white/10 rounded-full p-1">
          {[["dash", "Overview"], ["animals", "Animals"], ["alerts", "Alerts"]].map(([k, n]) => (
            <button key={k} onClick={() => { setView(k); setSel(null); }} className={`px-4 py-1.5 rounded-full font-medium transition-colors ${!sel && view === k ? "bg-emerald-400 text-[#04120d] shadow-md" : "text-slate-400 hover:text-white"}`}>{n}</button>))}
          <button className="px-3 text-slate-400 hover:text-slate-800" onClick={() => { localStorage.removeItem("t"); setToken(null); }}>Log out</button>
        </nav>
      </header>
      {sel ? <Animal id={sel} api={api} back={() => setSel(null)} />
        : view === "dash" ? <Dash api={api} open={setSel} /> : view === "alerts" ? <Alerts api={api} open={setSel} /> : <Animals api={api} open={setSel} />}
    </div>
  );
}

function Login({ api, onLogin }) {
  const [f, setF] = useState({ username: "", password: "" }); const [mode, setMode] = useState("login"); const [err, setErr] = useState("");
  const go = async (e) => { e.preventDefault(); try { onLogin((await api("/auth/" + mode, "POST", f)).token); } catch (x) { setErr(x.message); } };
  return (
    <form onSubmit={go} className={`${card} max-w-sm mx-auto mt-24 p-8 space-y-3`}>
      <div className="hero rounded-2xl text-white p-5 mb-4"><h1 className="serif text-3xl">Herd Watch</h1><p className="text-sm text-white/80 mt-1">Spot livestock health problems early.</p></div>
      <input className={input} placeholder="Username" onChange={(e) => setF({ ...f, username: e.target.value })} />
      <input className={input} type="password" placeholder="Password" onChange={(e) => setF({ ...f, password: e.target.value })} />
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <button className="btn w-full">{mode === "login" ? "Log in" : "Create account"}</button>
      <button type="button" className={link} onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "I already have an account"}</button>
    </form>
  );
}

function Dash({ api, open }) {
  const [d, setD] = useState(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const load = () => api("/dashboard").then(setD);
  useEffect(() => { load(); }, [api]);
  if (!d) return null;
  const parts = [["Healthy", d.Healthy], ["Monitor", d.Monitor], ["At Risk", d["At Risk"]], ["High Risk", d["High Risk"]]];
  const loadDemo = async () => { setBusy(true); setMsg(""); try { await api("/demo", "POST"); await load(); } catch (x) { setMsg(x.message); } setBusy(false); };
  const simAll = async () => { setBusy(true); setMsg(""); try { if (!d.total) for (let i = 1; i <= 5; i++) await api("/animals", "POST", { animal_id: "COW00" + i, species: "Cow", breed: "Holstein", age: 2 + i, gender: "F" }).catch(() => {}); await api("/simulate-all", "POST"); await load(); } catch (x) { setMsg(x.message); } setBusy(false); };
  return (
    <>
      <div className="hero rounded-3xl text-white p-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-white/80 text-sm">Your herd today</p><p className="serif text-6xl">{d.total}<span className="text-lg font-sans ml-2 text-white/80">animals</span></p>
          <p className="text-sm mt-2 text-white/90">{d.open_alerts ? `${d.open_alerts} open alert${d.open_alerts > 1 ? "s" : ""} need attention` : "No open alerts"}</p></div>
        <button onClick={simAll} disabled={busy} className="bg-emerald-400 text-[#04120d] text-sm font-semibold rounded-xl px-4 py-2 hover:bg-emerald-300 disabled:opacity-50">{busy ? "Simulating…" : d.total ? "Simulate whole herd" : "Create demo herd and simulate"}</button>
        <button onClick={loadDemo} disabled={busy} className="text-sm text-white/90 underline underline-offset-4 disabled:opacity-50">Load demo data</button>
        {msg && <p className="w-full text-sm text-white">{msg}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {parts.map(([l, n]) => <div key={l} className={`rounded-2xl border p-4 ${S[l].tile}`}><div className={`serif text-5xl ${S[l].txt}`}>{n}</div><div className="mt-1 text-sm text-slate-300">{l}</div></div>)}
      </div>
      {d.due_followups?.length > 0 && <div className={`${card} p-4 mt-4`}><p className="font-semibold text-sm mb-2">Follow-ups due</p>{d.due_followups.map((x) => <button key={x.animal_id + x.follow_up_date} onClick={() => open(x.animal_id)} className="block text-sm text-emerald-300 hover:underline">{x.animal_id} · due {x.follow_up_date}</button>)}</div>}
      {d.total > 0 && <div className="flex h-3 rounded-full overflow-hidden bg-white/10 mt-5">{parts.map(([l, n]) => n > 0 && <div key={l} className={S[l].dot} style={{ width: `${(n / d.total) * 100}%` }} />)}</div>}
    </>
  );
}

function Animals({ api, open }) {
  const [list, setList] = useState([]); const [err, setErr] = useState(""); const [show, setShow] = useState(false);
  const [q, setQ] = useState(""); const [lvl, setLvl] = useState("All");
  const shown = list.filter((a) => (lvl === "All" || a.risk_level === lvl) && (a.animal_id + a.species + a.breed).toLowerCase().includes(q.toLowerCase()));
  const [f, setF] = useState({ animal_id: "", species: "Cow", breed: "", age: "", gender: "F" });
  const load = () => api("/animals").then(setList);
  useEffect(() => { load(); }, []);
  const add = async (e) => { e.preventDefault(); try { await api("/animals", "POST", { ...f, age: +f.age || 0 }); setErr(""); setShow(false); load(); } catch (x) { setErr(x.message); } };
  return (
    <>
      <div className="flex justify-between items-start"><Title>Animals</Title><button className="btn" onClick={() => setShow(!show)}>{show ? "Cancel" : "+ Add animal"}</button></div>
      {show && (
        <form onSubmit={add} className={`${card} p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5`}>
          {[["animal_id", "ID, e.g. COW001"], ["species", "Species"], ["breed", "Breed"], ["age", "Age (years)"], ["gender", "Sex"]].map(([k, p]) => <input key={k} className={input} placeholder={p} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
          <button className="btn col-span-2 sm:col-span-5">Save animal</button>
          {err && <p className="text-rose-400 text-sm col-span-full">{err}</p>}
        </form>
      )}
      {list.length === 0 && <p className="text-slate-400 text-sm">No animals yet. Add your first one to start tracking.</p>}
      {list.length > 0 && <div className="flex gap-2 mb-3"><input className={input} placeholder="Search animals" value={q} onChange={(e) => setQ(e.target.value)} /><select className={input + " !w-40"} value={lvl} onChange={(e) => setLvl(e.target.value)}>{["All", "Healthy", "Monitor", "At Risk", "High Risk", "No data"].map((o) => <option key={o}>{o}</option>)}</select></div>}
      <div className="space-y-2">
        {shown.map((a) => (
          <button key={a.animal_id} onClick={() => open(a.animal_id)} className={`${card} w-full flex items-center gap-4 p-4 text-left hover:border-emerald-400/40 hover:-translate-y-0.5 transition`}>
            <span className={`w-11 h-11 rounded-full grid place-items-center text-[#04120d] text-sm font-bold ring-4 ring-[#111b18] ${S[a.risk_level].dot}`}>{a.animal_id.slice(0, 2).toUpperCase()}</span>
            <span className="flex-1"><span className="font-semibold block">{a.animal_id}</span><span className="text-slate-400 text-sm">{[a.species, a.breed].filter(Boolean).join(" · ")}</span></span>
            <Chip l={a.risk_level} />
          </button>
        ))}
      </div>
    </>
  );
}

function Alerts({ api, open }) {
  const [a, setA] = useState([]);
  useEffect(() => { api("/alerts").then(setA); }, [api]);
  return (
    <>
      <Title>Alerts</Title>
      {!a.length && <p className="text-slate-400 text-sm">Nothing to review. Animals at risk will show up here.</p>}
      <div className="space-y-2">
        {a.map((x) => (
          <button key={x.alert_id} onClick={() => open(x.animal_id)} className={`w-full text-left rounded-2xl border p-4 hover:shadow-md transition ${S[x.risk_level].tile}`}>
            <div className="flex justify-between items-center"><span className="font-semibold">{x.animal_id}</span><Chip l={x.risk_level} /></div>
            <p className="text-sm text-slate-300 mt-2">{x.message}</p>
            <p className="text-xs text-slate-400 mt-1">{x.status === "open" ? "Open" : "Resolved"} · score {x.risk_score}</p>
          </button>
        ))}
      </div>
    </>
  );
}

function Animal({ id, api, back }) {
  const [tab, setTab] = useState("manual");
  const [f, setF] = useState({ temperature: "", heart_rate: "", activity: "normal", food_intake: "normal", water_intake: "normal", symptoms: "" });
  const [res, setRes] = useState(null); const [h, setH] = useState({ health: [], vet: [] }); const [err, setErr] = useState("");
  const [v, setV] = useState({ assessment: "", recommendation: "", follow_up_date: "" });
  const load = () => api(`/animals/${id}/history`).then(setH);
  useEffect(() => { load(); }, [id]);
  const num = (x) => (x === "" ? null : +x);
  const submit = async (e) => { e.preventDefault(); try { setRes(await api(`/animals/${id}/health`, "POST", { ...f, temperature: num(f.temperature), heart_rate: num(f.heart_rate) })); setErr(""); load(); } catch (x) { setErr(x.message); } };
  const sim = async (mode) => { try { setErr(""); setRes(await api(`/animals/${id}/simulate?mode=${mode}`, "POST")); load(); } catch (x) { setErr(x.message); } };
  const saveVet = async (e) => { e.preventDefault(); await api(`/animals/${id}/vet`, "POST", v); setV({ assessment: "", recommendation: "", follow_up_date: "" }); load(); };
  const sel = (k, label, opts) => <label className="text-xs font-medium text-slate-400">{label}<select className={input + " mt-1 text-slate-100"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{opts.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}</select></label>;
  const field = (k, label, ph) => <label className="text-xs font-medium text-slate-400">{label}<input className={input + " mt-1 text-slate-100"} placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  const last = h.health[h.health.length - 1];
  return (
    <>
      <div className="flex justify-between"><button className={link} onClick={back}>← All animals</button><button className="text-sm text-rose-400 hover:underline" onClick={async () => { if (confirm(`Delete ${id} and all its records?`)) { await api(`/animals/${id}`, "DELETE"); back(); } }}>Delete animal</button></div>
      <div className="flex items-center gap-3 mt-3 mb-6"><h2 className="serif text-4xl">{id}</h2>{last && <Chip l={last.risk_level} />}</div>
      <div className={`${card} p-5`}>
        <div className="inline-flex bg-white/5 rounded-full p-1 text-sm mb-4">
          {[["manual", "Enter manually"], ["sim", "Simulate"]].map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full font-medium ${tab === k ? "bg-emerald-400 text-[#04120d] shadow-md" : "text-slate-400"}`}>{n}</button>)}
        </div>
        {tab === "manual" ? (
          <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {field("temperature", "Temperature (°C)", "39.2")}{field("heart_rate", "Heart rate (bpm)", "70")}
            {sel("activity", "Activity", ["normal", "low", "very_low"])}{sel("food_intake", "Food intake", ["normal", "reduced", "none"])}{sel("water_intake", "Water intake", ["normal", "reduced", "none"])}
            {field("symptoms", "Symptoms", "lethargy, cough")}
            <div className="col-span-full"><button className="btn">Check health</button></div>
            {err && <p className="text-rose-400 text-sm col-span-full">{err}</p>}
          </form>
        ) : (
          <div>
            <p className="text-sm text-slate-400 mb-3">Generates a made-up reading and runs it through the same rules. Saved as “Simulated” in the history.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => sim("healthy")}>Healthy reading</button>
              <button className="btn !bg-none !bg-rose-400 !shadow-none" onClick={() => sim("sick")}>Sick reading</button>
              <button className="btn !bg-none !bg-violet-400 !shadow-none" onClick={() => sim("random")}>Random</button>
            </div>
            {err && <p className="text-rose-400 text-sm mt-3">{err}</p>}
          </div>
        )}
      </div>
      {res && (
        <div className={`mt-5 rounded-2xl border p-5 ${S[res.risk_level].panel}`}>
          <div className="flex items-baseline gap-3"><span className="serif text-4xl">{res.risk_level}</span><span className="text-slate-400 text-sm">score {res.risk_score}</span><Source s={res.source} /></div>
          <div className="text-sm mt-3 space-y-1">{res.breakdown.map((b) => <div key={b.rule} className="flex justify-between border-b border-black/5 pb-1"><span>{b.rule}</span><b>+{b.points}</b></div>)}</div>
          <p className="text-sm mt-3 font-medium">{res.recommendation}</p>
        </div>
      )}
      <h3 className="serif text-xl mt-10 mb-3">Risk over time</h3>
      <div className={`${card} p-4 h-52`}>
        <ResponsiveContainer><AreaChart data={h.health.map((r, i) => ({ n: i + 1, score: r.risk_score }))}>
          <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.45} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient></defs>
          <XAxis dataKey="n" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} width={28} stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#111b18", border: "1px solid #ffffff1a", borderRadius: 8 }} /><Area dataKey="score" stroke="#34d399" strokeWidth={2.5} fill="url(#g)" />
        </AreaChart></ResponsiveContainer>
      </div>
      <h3 className="serif text-xl mt-10 mb-3">Vet follow-up</h3>
      <form onSubmit={saveVet} className={`${card} p-4 space-y-2`}>
        <input className={input} placeholder="Assessment" value={v.assessment} onChange={(e) => setV({ ...v, assessment: e.target.value })} />
        <input className={input} placeholder="Recommendation" value={v.recommendation} onChange={(e) => setV({ ...v, recommendation: e.target.value })} />
        <input className={input} type="date" value={v.follow_up_date} onChange={(e) => setV({ ...v, follow_up_date: e.target.value })} />
        <button className="btn">Save and resolve alerts</button>
        {h.vet.map((x) => <p key={x.record_id} className="text-sm border-t border-white/10 pt-2">{x.assessment}<span className="text-slate-400"> — {x.recommendation}{x.follow_up_date && `, follow up ${x.follow_up_date}`}</span></p>)}
      </form>
      <h3 className="serif text-xl mt-10 mb-3">History</h3>
      <div className={`${card} divide-y divide-white/5`}>
        {[...h.health].reverse().map((r) => (
          <div key={r.record_id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="text-slate-400">{r.timestamp?.slice(0, 16).replace("T", " ")} · {r.temperature ?? "–"}°C</span>
            <span className="flex items-center gap-2"><Source s={r.source} /><Chip l={r.risk_level} /></span>
          </div>
        ))}
      </div>
    </>
  );
}

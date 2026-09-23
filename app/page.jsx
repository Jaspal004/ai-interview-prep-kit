"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const QUESTION_CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"];

export default function Home() {
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState({ email: "", password: "" });
  const [mode, setMode] = useState("login");
  const [kits, setKits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/me").then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) refreshKits();
  }, [user]);

  async function submitAuth(event) {
    event.preventDefault();
    setError("");
    try {
      const next = await api(`/auth/${mode}`, { method: "POST", body: auth });
      setUser(next);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshKits() {
    const items = await api("/kits");
    setKits(items);
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    setSelected(null);
    setKits([]);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-paper">
        <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 md:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-clay">Interview prep builder</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-ink md:text-6xl">AI Interview Prep Kit</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
              Paste a job description and company site, then get a structured kit with research notes, questions, flashcards, and a deterministic study schedule.
            </p>
          </div>
          <form onSubmit={submitAuth} className="border-y border-stone-200 bg-white p-5 shadow-sm md:p-8">
            <div className="mb-5 flex rounded-md border border-stone-300 p-1">
              <button type="button" className={`btn flex-1 ${mode === "login" ? "btn-primary" : ""}`} onClick={() => setMode("login")}>Login</button>
              <button type="button" className={`btn flex-1 ${mode === "register" ? "btn-primary" : ""}`} onClick={() => setMode("register")}>Register</button>
            </div>
            <label className="mb-4 block text-sm font-semibold">Email<input className="field mt-1" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} /></label>
            <label className="mb-4 block text-sm font-semibold">Password<input className="field mt-1" type="password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} /></label>
            {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className="btn btn-primary w-full" type="submit">Continue</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">AI Interview Prep Kit</h1>
            <p className="text-sm text-stone-600">{user.email}</p>
          </div>
          <button className="btn btn-secondary" onClick={logout}>Logout</button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <CreateKit onCreated={(item) => { setSelected(item); refreshKits(); }} setStatus={setStatus} setError={setError} />
          <BatchCreate onDone={refreshKits} setStatus={setStatus} setError={setError} />
          <KitList kits={kits} onSelect={async (id) => setSelected(await api(`/kits/${id}`))} />
        </aside>
        <section>
          {status && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{status}</p>}
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {selected ? <KitEditor item={selected} setItem={setSelected} onSaved={refreshKits} /> : <EmptyState />}
        </section>
      </div>
    </main>
  );
}

function CreateKit({ onCreated, setStatus, setError }) {
  const [form, setForm] = useState({ jd: "", company_url: "", days: 5 });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("Generating kit: extracting requirements, crawling company pages, checking coverage, and allocating schedule.");
    setError("");
    try {
      const item = await api("/kits", { method: "POST", body: form });
      onCreated(item);
      setStatus("Kit generated and saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel p-4">
      <h2 className="mb-3 font-bold">Create kit</h2>
      <label className="mb-3 block text-sm font-semibold">Company URL<input className="field mt-1" value={form.company_url} onChange={(e) => setForm({ ...form, company_url: e.target.value })} placeholder="https://example.com" /></label>
      <label className="mb-3 block text-sm font-semibold">Days<input className="field mt-1" type="number" min="1" max="60" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></label>
      <label className="mb-3 block text-sm font-semibold">Job description<textarea className="field mt-1 min-h-36" value={form.jd} onChange={(e) => setForm({ ...form, jd: e.target.value })} /></label>
      <button disabled={loading} className="btn btn-primary w-full">{loading ? "Generating..." : "Generate"}</button>
    </form>
  );
}

function BatchCreate({ onDone, setStatus, setError }) {
  const [text, setText] = useState("");
  async function submit() {
    setStatus("Running batch cases through the shared pipeline.");
    setError("");
    try {
      const cases = JSON.parse(text);
      await api("/kits/batch", { method: "POST", body: { cases } });
      setStatus("Batch complete.");
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="panel p-4">
      <h2 className="mb-3 font-bold">Batch paste</h2>
      <textarea className="field min-h-24" value={text} onChange={(e) => setText(e.target.value)} placeholder='[{"id":"case-1","jd":"...","company_url":"https://...","days":5}]' />
      <button className="btn btn-secondary mt-3 w-full" type="button" onClick={submit}>Run batch</button>
    </div>
  );
}

function KitList({ kits, onSelect }) {
  return (
    <div className="panel p-4">
      <h2 className="mb-3 font-bold">Your kits</h2>
      <div className="space-y-2">
        {kits.length === 0 && <p className="text-sm text-stone-600">No kits yet.</p>}
        {kits.map((item) => (
          <button key={item.id} className="w-full rounded-md border border-stone-200 bg-white p-3 text-left hover:border-fern" onClick={() => onSelect(item.id)}>
            <p className="font-semibold">{item.kit.source.role || "Untitled role"}</p>
            <p className="text-sm text-stone-600">{item.kit.source.company || item.kit.source.company_url}</p>
            <p className="mt-1 text-xs text-stone-500">{item.kit.question_count} questions · {item.kit.schedule.days_available} days</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return <div className="panel flex min-h-80 items-center justify-center p-8 text-center text-stone-600">Create or select a kit to start editing and practicing.</div>;
}

function KitEditor({ item, setItem, onSaved }) {
  const [kit, setKit] = useState(item.kit);
  const [tab, setTab] = useState("brief");
  const [saving, setSaving] = useState(false);
  useEffect(() => setKit(item.kit), [item.id]);

  async function save(nextKit = kit) {
    setSaving(true);
    const saved = await api(`/kits/${item.id}`, { method: "PUT", body: { kit: nextKit } });
    setItem(saved);
    onSaved();
    setSaving(false);
  }

  async function regenerate(section) {
    const saved = await api(`/kits/${item.id}/regenerate`, { method: "POST", body: { section } });
    setItem(saved);
    setKit(saved.kit);
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{kit.role.title}</h2>
            <p className="text-sm text-stone-600">{kit.source.company} · {kit.role.seniority} · {kit.schedule.days_available} days</p>
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={() => save()}>{saving ? "Saving" : "Save"}</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["brief", "role", "questions", "flashcards", "schedule", "practice"].map((name) => (
            <button key={name} className={`btn ${tab === name ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(name)}>{name}</button>
          ))}
        </div>
      </div>
      {tab === "brief" && <BriefEditor kit={kit} setKit={setKit} regenerate={regenerate} />}
      {tab === "role" && <RoleView kit={kit} />}
      {tab === "questions" && <QuestionEditor kit={kit} setKit={setKit} regenerate={regenerate} />}
      {tab === "flashcards" && <FlashcardEditor kit={kit} setKit={setKit} regenerate={regenerate} />}
      {tab === "schedule" && <ScheduleView kit={kit} regenerate={regenerate} />}
      {tab === "practice" && <Practice kit={kit} setKit={setKit} save={save} />}
    </div>
  );
}

function BriefEditor({ kit, setKit, regenerate }) {
  return <div className="panel space-y-3 p-4">
    <Toolbar title="Company brief" action={() => regenerate("company_brief")} />
    <textarea className="field min-h-24" value={kit.company_brief.summary} onChange={(e) => setKit({ ...kit, company_brief: { ...kit.company_brief, summary: e.target.value } })} />
    <textarea className="field min-h-28" value={kit.company_brief.what_they_do} onChange={(e) => setKit({ ...kit, company_brief: { ...kit.company_brief, what_they_do: e.target.value } })} />
    <p className="text-sm text-stone-600">Sources: {kit.company_brief.sources.length ? kit.company_brief.sources.join(", ") : "none reachable"}</p>
    <p className="text-sm text-stone-600">{kit.research_notes?.hiring_notes}</p>
  </div>;
}

function RoleView({ kit }) {
  return <div className="panel p-4">
    <h3 className="mb-3 font-bold">Requirements</h3>
    <div className="grid gap-2">
      {kit.role.requirements.map((req) => <div key={req.id} className="rounded-md border border-stone-200 p-3"><span className="font-mono text-xs">{req.id}</span> <b>{req.priority}</b> · {req.kind}<p>{req.text}</p></div>)}
    </div>
  </div>;
}

function QuestionEditor({ kit, setKit, regenerate }) {
  const grouped = useMemo(() => groupBy(kit.questions, "category"), [kit.questions]);
  function updateQuestion(id, patch) {
    setKit({ ...kit, questions: kit.questions.map((q) => q.id === id ? { ...q, ...patch, state: "edited" } : q) });
  }
  function updateRequirementIds(id, value) {
    updateQuestion(id, { requirement_ids: value.split(",").map((item) => item.trim()).filter(Boolean) });
  }
  function move(index, delta) {
    const next = [...kit.questions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setKit({ ...kit, questions: next });
  }
  function addQuestion() {
    const id = nextId("q", kit.questions);
    setKit({ ...kit, questions: [...kit.questions, { id, requirement_ids: [], category: "technical", prompt: "", answer_outline: "", difficulty: 1, state: "manual", pinned: true }] });
  }
  return <div className="space-y-4">
    <div className="flex justify-between"><button className="btn btn-secondary" onClick={addQuestion}>Add question</button></div>
    {QUESTION_CATEGORIES.map((category) => {
      const questions = grouped[category] || [];
      return <div key={category} className="panel p-4">
      <Toolbar title={category} action={() => regenerate(`questions:${category}`)} />
      {questions.length === 0 && <p className="text-sm text-stone-600">No questions in this category yet.</p>}
      {questions.map((q) => {
        const index = kit.questions.findIndex((item) => item.id === q.id);
        return <div key={q.id} className="mb-3 rounded-md border border-stone-200 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">#{index + 1}</span>
            <button className="btn btn-secondary" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
            <button className="btn btn-secondary" disabled={index === kit.questions.length - 1} onClick={() => move(index, 1)}>Move down</button>
            <select className="field max-w-48" value={q.category} onChange={(e) => updateQuestion(q.id, { category: e.target.value })}>
              {QUESTION_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
            </select>
            <select className="field max-w-28" value={q.difficulty} onChange={(e) => updateQuestion(q.id, { difficulty: Number(e.target.value) })}>
              <option value={1}>easy</option>
              <option value={2}>medium</option>
              <option value={3}>hard</option>
            </select>
            <button className="btn btn-secondary" onClick={() => setKit({ ...kit, questions: kit.questions.filter((item) => item.id !== q.id) })}>Delete</button>
          </div>
          <label className="mb-2 block text-xs font-semibold text-stone-600">Requirement ids<input className="field mt-1" value={(q.requirement_ids || []).join(", ")} onChange={(e) => updateRequirementIds(q.id, e.target.value)} /></label>
          <textarea className="field mb-2" value={q.prompt} onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })} />
          <textarea className="field" value={q.answer_outline} onChange={(e) => updateQuestion(q.id, { answer_outline: e.target.value })} />
        </div>;
      })}
    </div>;
    })}
  </div>;
}

function FlashcardEditor({ kit, setKit, regenerate }) {
  function update(id, patch) {
    setKit({ ...kit, flashcards: kit.flashcards.map((card) => card.id === id ? { ...card, ...patch, state: "edited" } : card) });
  }
  return <div className="panel p-4">
    <Toolbar title="Flashcards" action={() => regenerate("flashcards")} />
    <button className="btn btn-secondary mb-3" onClick={() => setKit({ ...kit, flashcards: [...kit.flashcards, { id: nextId("f", kit.flashcards), front: "", back: "", requirement_ids: [], state: "manual", pinned: true }] })}>Add flashcard</button>
    {kit.flashcards.map((card) => <div key={card.id} className="mb-3 rounded-md border border-stone-200 p-3">
      <div className="mb-2 flex justify-end"><button className="btn btn-secondary" onClick={() => setKit({ ...kit, flashcards: kit.flashcards.filter((item) => item.id !== card.id) })}>Delete</button></div>
      <input className="field mb-2" value={card.front} onChange={(e) => update(card.id, { front: e.target.value })} />
      <textarea className="field" value={card.back} onChange={(e) => update(card.id, { back: e.target.value })} />
    </div>)}
  </div>;
}

function ScheduleView({ kit, regenerate }) {
  return <div className="panel p-4">
    <Toolbar title="Schedule" action={() => regenerate("schedule")} />
    <div className="grid gap-2">
      {kit.schedule.days.map((day) => <div key={day.day} className="rounded-md border border-stone-200 p-3"><b>Day {day.day}</b> · {day.minutes} min<p>{day.focus}</p><p className="text-sm text-stone-600">{day.question_ids.join(", ")}</p></div>)}
    </div>
  </div>;
}

function Practice({ kit, setKit, save }) {
  const ordered = [...kit.flashcards].sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const card = ordered[index % Math.max(ordered.length, 1)];
  if (!card) return <div className="panel p-4">No flashcards yet.</div>;
  function rate(confidence) {
    const next = { ...kit, flashcards: kit.flashcards.map((item) => item.id === card.id ? { ...item, confidence, last_reviewed_at: new Date().toISOString() } : item) };
    setKit(next);
    save(next);
    setShow(false);
    setIndex(index + 1);
  }
  const covered = kit.flashcards.filter((item) => item.confidence !== null && item.confidence !== undefined).length;
  return <div className="panel p-4">
    <p className="mb-3 text-sm text-stone-600">{covered}/{kit.flashcards.length} covered · least confident cards appear first</p>
    <div className="rounded-md border border-stone-200 bg-white p-5">
      <p className="text-lg font-semibold">{card.front}</p>
      {show && <p className="mt-4 text-stone-700">{card.back}</p>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="btn btn-secondary" onClick={() => setShow(!show)}>{show ? "Hide" : "Reveal"}</button>
      {[1, 2, 3, 4, 5].map((value) => <button key={value} className="btn btn-secondary" onClick={() => rate(value)}>{value}</button>)}
    </div>
  </div>;
}

function Toolbar({ title, action }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold capitalize">{title}</h3><button className="btn btn-secondary" onClick={action}>Regenerate</button></div>;
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] ||= [];
    acc[item[key]].push(item);
    return acc;
  }, {});
}

function nextId(prefix, items) {
  const used = new Set(items.map((item) => item.id));
  let index = items.length + 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

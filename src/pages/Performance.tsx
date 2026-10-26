import { useState } from "react";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { fmt, today } from "../lib/dates";
import type { Goal, Review, ReviewCycle } from "../lib/types";
import { Badge, ConfirmButton, Empty, Field, Modal, PageHead, Person, Seg, Stars, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

type View = "mine" | "team" | "goals" | "cycles";

export function Performance() {
  const { t } = useT();
  const { me, isHR, isManager } = useSession();
  const views: [View, string][] = [];
  if (me) views.push(["mine", t("perf.mine")]);
  if (isManager || isHR) views.push(["team", t("perf.team")]);
  views.push(["goals", t("perf.goals")]);
  if (isHR) views.push(["cycles", t("perf.cycles")]);
  const [view, setView] = useState<View>(views[0][0]);

  const { data, reload } = useQuery(async () => {
    const [cycles, reviews, goals] = await Promise.all([
      must(supabase.from("review_cycles").select("*").order("start_date", { ascending: false })),
      must(supabase.from("reviews_visible").select("*")),
      must(supabase.from("goals").select("*").order("due_date")),
    ]);
    return { cycles: cycles as ReviewCycle[], reviews: reviews as Review[], goals: goals as Goal[] };
  }, []);

  return (
    <>
      <PageHead title={t("nav.performance")} sub={t("perf.sub")} />
      <Seg value={view} onChange={setView} options={views} />
      {data && view === "mine" && <MyReviews data={data} reload={reload} />}
      {data && view === "team" && <TeamReviews data={data} reload={reload} />}
      {data && view === "goals" && <Goals goals={data.goals} reload={reload} />}
      {data && view === "cycles" && <Cycles data={data} reload={reload} />}
    </>
  );
}

type Data = { cycles: ReviewCycle[]; reviews: Review[]; goals: Goal[] };

function RatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="rating" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)} title={t(`perf.r${n}` as "perf.r1")}>{n}</button>)}
      </div>
      {value > 0 && <span className="small muted">{t(`perf.r${value}` as "perf.r1")}</span>}
    </div>
  );
}

function ReviewForm({ review, cycle, as, onDone }: { review: Review; cycle: ReviewCycle; as: "self" | "manager"; onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [rating, setRating] = useState((as === "self" ? review.self_rating : review.manager_rating) ?? 0);
  const [comment, setComment] = useState((as === "self" ? review.self_comment : review.manager_comment) ?? "");
  const [busy, setBusy] = useState(false);
  const open = cycle.status === "active";

  async function submit() {
    if (!rating) return toast(t("perf.pickRating"), true);
    setBusy(true);
    try {
      await must(supabase.rpc(as === "self" ? "submit_self_review" : "submit_manager_review", { p_id: review.id, p_rating: rating, p_comment: comment.trim() || null }));
      toast(t("perf.submitted"));
      onDone();
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <Field label={as === "self" ? t("perf.selfRating") : t("perf.mgrRating")}><RatingInput value={rating} onChange={open ? setRating : () => {}} /></Field>
      <Field label={as === "self" ? t("perf.selfComment") : t("perf.mgrComment")} hint={as === "self" ? t("perf.selfHint") : t("perf.mgrHint")}>
        <textarea rows={5} value={comment} onChange={(e) => setComment(e.target.value)} disabled={!open} />
      </Field>
      {open && <div><button className="btn primary" disabled={busy} onClick={submit}>{(as === "self" ? review.self_submitted_at : review.manager_submitted_at) ? t("perf.update") : t("perf.submit")}</button></div>}
    </div>
  );
}

function MyReviews({ data, reload }: { data: Data; reload: () => void }) {
  const { t } = useT();
  const { me } = useSession();
  const mine = data.reviews.filter((r) => r.employee_id === me?.id);
  if (!mine.length) return <div className="card"><Empty>{t("perf.noMine")}</Empty></div>;
  return (
    <div className="stack lg">
      {mine.map((r) => {
        const c = data.cycles.find((x) => x.id === r.cycle_id)!;
        return (
          <section className="card" key={r.id}>
            <div className="card-head">
              <h2>{c.name}</h2>
              <div className="row"><span className="small muted">{fmt(c.start_date)} – {fmt(c.end_date)}</span><Badge tone={c.status === "active" ? "info" : "mute"}>{t(`perf.c.${c.status}`)}</Badge></div>
            </div>
            <div className="card-body grid cols-2">
              <ReviewForm review={r} cycle={c} as="self" onDone={reload} />
              <div className="stack">
                <h3>{t("perf.mgrFeedback")}</h3>
                {c.status === "closed" && r.manager_submitted_at ? (
                  <><Stars n={r.manager_rating} /><p style={{ whiteSpace: "pre-wrap" }}>{r.manager_comment || "—"}</p></>
                ) : <p className="muted small">{t("perf.mgrHidden")}</p>}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TeamReviews({ data, reload }: { data: Data; reload: () => void }) {
  const { t } = useT();
  const { me, emp, isHR } = useSession();
  const [open, setOpen] = useState<Review | null>(null);
  const list = data.reviews.filter((r) => r.reviewer_id === me?.id || (isHR && r.employee_id !== me?.id));
  const activeIds = new Set(data.cycles.filter((c) => c.status === "active").map((c) => c.id));
  const shown = list.filter((r) => activeIds.has(r.cycle_id) || r.reviewer_id === me?.id);
  return (
    <section className="card">
      <div className="list">
        {shown.length ? shown.map((r) => {
          const c = data.cycles.find((x) => x.id === r.cycle_id)!;
          return (
            <div className="item" key={r.id}>
              <div className="grow"><Person emp={emp(r.employee_id)} sub={`${c.name} · ${t("perf.reviewer")}: ${emp(r.reviewer_id)?.full_name ?? "—"}`} /></div>
              <Badge tone={r.self_submitted_at ? "ok" : "mute"}>{t("perf.self")}: {r.self_submitted_at ? "✓" : "—"}</Badge>
              <Badge tone={r.manager_submitted_at ? "ok" : "warn"}>{t("perf.manager")}: {r.manager_submitted_at ? "✓" : "—"}</Badge>
              <button className="btn sm" onClick={() => setOpen(r)}>{t("perf.open")}</button>
            </div>
          );
        }) : <Empty>{t("perf.noTeam")}</Empty>}
      </div>
      {open && (() => {
        const c = data.cycles.find((x) => x.id === open.cycle_id)!;
        return (
          <Modal wide title={`${emp(open.employee_id)?.full_name ?? ""} · ${c.name}`} onClose={() => setOpen(null)}>
            <div className="grid cols-2">
              <div className="stack">
                <h3>{t("perf.selfAssessment")}</h3>
                {open.self_submitted_at ? <><Stars n={open.self_rating} /><p style={{ whiteSpace: "pre-wrap" }}>{open.self_comment || "—"}</p></> : <p className="muted small">{t("perf.notYet")}</p>}
              </div>
              <ReviewForm review={open} cycle={c} as="manager" onDone={() => { setOpen(null); reload(); }} />
            </div>
          </Modal>
        );
      })()}
    </section>
  );
}

function Goals({ goals, reload }: { goals: Goal[]; reload: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { me, emp, isHR, isManager } = useSession();
  const [edit, setEdit] = useState<Goal | "new" | null>(null);
  const [who, setWho] = useState<"mine" | "team">(me ? "mine" : "team");
  const list = goals.filter((g) => (who === "mine" ? g.employee_id === me?.id : g.employee_id !== me?.id));

  async function progress(g: Goal, p: number) {
    try {
      await must(supabase.from("goals").update({ progress: p, status: p >= 100 ? "done" : g.status === "done" ? "on_track" : g.status }).eq("id", g.id));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        {(isHR || isManager) && me ? <Seg value={who} onChange={setWho} options={[["mine", t("perf.myGoals")], ["team", t("perf.teamGoals")]]} /> : <h2>{t("perf.goals")}</h2>}
        <button className="btn primary sm" onClick={() => setEdit("new")}><Icon name="plus" size={15} /> {t("perf.newGoal")}</button>
      </div>
      <div className="list">
        {list.length ? list.map((g) => (
          <div className="item" key={g.id} style={{ alignItems: "flex-start" }}>
            <div className="grow stack" style={{ gap: 6 }}>
              <div className="row between">
                <b>{g.title}</b>
                <div className="row">
                  {who === "team" && <span className="small muted">{emp(g.employee_id)?.full_name}</span>}
                  <Badge tone={g.status === "done" ? "ok" : g.status === "at_risk" ? "warn" : "info"}>{t(`perf.g.${g.status}`)}</Badge>
                  {g.due_date && <span className="small faint">{fmt(g.due_date)}</span>}
                </div>
              </div>
              {g.description && <span>{g.description}</span>}
              <div className="row">
                <input type="range" min={0} max={100} step={5} defaultValue={g.progress} style={{ maxWidth: 260 }} onMouseUp={(e) => progress(g, Number(e.currentTarget.value))} onKeyUp={(e) => progress(g, Number(e.currentTarget.value))} onTouchEnd={(e) => progress(g, Number(e.currentTarget.value))} aria-label={t("perf.progress")} />
                <span className="num small">{g.progress}%</span>
                <button className="btn ghost sm" onClick={() => setEdit(g)}>{t("common.edit")}</button>
              </div>
            </div>
          </div>
        )) : <Empty>{t("perf.noGoals")}</Empty>}
      </div>
      {edit && <GoalModal goal={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </section>
  );
}

function GoalModal({ goal, onClose, onSaved }: { goal?: Goal; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const { me, employees, isHR } = useSession();
  const reports = employees.filter((e) => isHR || e.manager_id === me?.id || e.id === me?.id);
  const [f, setF] = useState({ employee_id: goal?.employee_id ?? me?.id ?? reports[0]?.id ?? "", title: goal?.title ?? "", description: goal?.description ?? "", due_date: goal?.due_date ?? "", status: goal?.status ?? "on_track" });
  const [err, setErr] = useState("");
  async function save() {
    if (!f.title.trim()) return setErr(t("perf.errTitle"));
    try {
      const row = { ...f, title: f.title.trim(), description: f.description.trim() || null, due_date: f.due_date || null };
      if (goal) await must(supabase.from("goals").update(row).eq("id", goal.id));
      else await must(supabase.from("goals").insert(row));
      onSaved();
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  }
  async function remove() {
    if (!goal) return;
    await supabase.from("goals").delete().eq("id", goal.id);
    onSaved();
    onClose();
  }
  return (
    <Modal title={goal ? t("perf.editGoal") : t("perf.newGoal")} onClose={onClose} footer={<>{goal && <span style={{ marginRight: "auto" }}><ConfirmButton onConfirm={remove}>{t("common.delete")}</ConfirmButton></span>}<button className="btn" onClick={onClose}>{t("common.cancel")}</button><button className="btn primary" onClick={save}>{t("common.save")}</button></>}>
      {reports.length > 1 && (
        <Field label={t("common.employee")}>
          <select value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>{reports.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
        </Field>
      )}
      <Field label={t("perf.goalTitle")}><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label={t("perf.goalDesc")}><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="form-grid">
        <Field label={t("perf.due")}><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label={t("emp.status")}>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Goal["status"] })}>
            {(["on_track", "at_risk", "done"] as const).map((s) => <option key={s} value={s}>{t(`perf.g.${s}`)}</option>)}
          </select>
        </Field>
      </div>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}

function Cycles({ data, reload }: { data: Data; reload: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { employees } = useSession();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());

  async function create() {
    if (!name.trim()) return;
    try {
      const c = (await must(supabase.from("review_cycles").insert({ name: name.trim(), start_date: start, end_date: end }).select().single())) as ReviewCycle;
      const rows = employees.filter((e) => e.status !== "inactive").map((e) => ({ cycle_id: c.id, employee_id: e.id, reviewer_id: e.manager_id }));
      if (rows.length) await must(supabase.from("reviews").insert(rows));
      toast(t("perf.cycleStarted", { n: rows.length }));
      setCreating(false);
      setName("");
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  async function setStatus(c: ReviewCycle, status: "active" | "closed") {
    try {
      await must(supabase.from("review_cycles").update({ status }).eq("id", c.id));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <section className="card">
      <div className="card-head"><h2>{t("perf.cycles")}</h2><button className="btn primary sm" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> {t("perf.newCycle")}</button></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("perf.cycle")}</th><th>{t("perf.period")}</th><th className="r">{t("perf.self")}</th><th className="r">{t("perf.manager")}</th><th className="r">{t("perf.avg")}</th><th>{t("emp.status")}</th><th /></tr></thead>
          <tbody>
            {data.cycles.map((c) => {
              const rs = data.reviews.filter((r) => r.cycle_id === c.id);
              const rated = rs.filter((r) => r.manager_rating);
              const avg = rated.length ? (rated.reduce((s, r) => s + (r.manager_rating ?? 0), 0) / rated.length).toFixed(1) : "—";
              return (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  <td className="nowrap">{fmt(c.start_date)} – {fmt(c.end_date)}</td>
                  <td className="r">{rs.filter((r) => r.self_submitted_at).length} / {rs.length}</td>
                  <td className="r">{rs.filter((r) => r.manager_submitted_at).length} / {rs.length}</td>
                  <td className="r">{avg}</td>
                  <td><Badge tone={c.status === "active" ? "info" : "mute"}>{t(`perf.c.${c.status}`)}</Badge></td>
                  <td className="r">{c.status === "active" ? <ConfirmButton className="btn sm" onConfirm={() => setStatus(c, "closed")}>{t("perf.close")}</ConfirmButton> : <button className="btn ghost sm" onClick={() => setStatus(c, "active")}>{t("perf.reopen")}</button>}</td>
                </tr>
              );
            })}
            {!data.cycles.length && <tr><td colSpan={7}><Empty>{t("perf.noCycles")}</Empty></td></tr>}
          </tbody>
        </table>
      </div>
      {creating && (
        <Modal title={t("perf.newCycle")} onClose={() => setCreating(false)} footer={<><button className="btn" onClick={() => setCreating(false)}>{t("common.cancel")}</button><button className="btn primary" onClick={create}>{t("perf.start")}</button></>}>
          <Field label={t("perf.cycleName")}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("perf.cyclePh")} /></Field>
          <div className="form-grid">
            <Field label={t("leave.from")}><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label={t("leave.to")}><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <p className="small muted">{t("perf.cycleHint")}</p>
        </Modal>
      )}
    </section>
  );
}

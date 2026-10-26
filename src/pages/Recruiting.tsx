import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { fmt, today } from "../lib/dates";
import { createDefaultChecklist } from "../lib/onboarding";
import type { Candidate, Employee, Job, Stage } from "../lib/types";
import { Badge, ConfirmButton, Empty, Field, Modal, PageHead, Stars, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

const STAGES: Stage[] = ["applied", "screening", "interview", "offer", "hired", "rejected"];

export function Recruiting() {
  const { t } = useT();
  const { isHR, dept } = useSession();
  const [jobId, setJobId] = useState<string>("");
  const [editJob, setEditJob] = useState<Job | "new" | null>(null);
  const [cand, setCand] = useState<Candidate | "new" | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const toast = useToast();

  const { data, reload } = useQuery(async () => {
    const jobs = (await must(supabase.from("jobs").select("*").order("created_at", { ascending: false }))) as Job[];
    const cands = isHR ? ((await must(supabase.from("candidates").select("*").order("created_at"))) as Candidate[]) : [];
    return { jobs, cands };
  }, [isHR]);

  const jobs = data?.jobs ?? [];
  const job = jobs.find((j) => j.id === jobId) ?? jobs.find((j) => j.status === "open") ?? jobs[0];
  const cands = (data?.cands ?? []).filter((c) => c.job_id === job?.id);

  async function move(id: string, stage: Stage) {
    try {
      await must(supabase.from("candidates").update({ stage }).eq("id", id));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  if (!isHR) {
    return (
      <>
        <PageHead title={t("rec.openings")} sub={t("rec.openingsSub")} />
        <div className="grid cols-2">
          {jobs.length ? jobs.map((j) => (
            <section className="card card-body stack" key={j.id}>
              <div className="row between"><h2>{j.title}</h2><Badge tone="ok">{t(`rec.type.${j.employment_type}`)}</Badge></div>
              <span className="small muted">{[dept(j.department_id)?.name, j.location].filter(Boolean).join(" · ")}</span>
              {j.description && <p style={{ whiteSpace: "pre-wrap" }}>{j.description}</p>}
              <p className="small faint">{t("rec.referHint")}</p>
            </section>
          )) : <div className="card"><Empty>{t("rec.noOpenings")}</Empty></div>}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title={t("nav.recruiting")} sub={t("rec.sub")}>
        <button className="btn" onClick={() => setEditJob("new")}><Icon name="plus" size={16} /> {t("rec.newJob")}</button>
        {job && <button className="btn primary" onClick={() => setCand("new")}><Icon name="plus" size={16} /> {t("rec.newCandidate")}</button>}
      </PageHead>

      {!jobs.length ? (
        <div className="card"><Empty action={<button className="btn primary" onClick={() => setEditJob("new")}>{t("rec.newJob")}</button>}>{t("rec.noJobs")}</Empty></div>
      ) : (
        <>
          <div className="row">
            <select style={{ maxWidth: 360 }} value={job?.id} onChange={(e) => setJobId(e.target.value)} aria-label={t("rec.job")}>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {t(`rec.st.${j.status}`)} ({(data?.cands ?? []).filter((c) => c.job_id === j.id && c.stage !== "rejected" && c.stage !== "hired").length})</option>)}
            </select>
            {job && <button className="btn ghost sm" onClick={() => setEditJob(job)}><Icon name="edit" size={15} /> {t("rec.editJob")}</button>}
            {job && <span className="small muted">{[dept(job.department_id)?.name, job.location, t(`rec.type.${job.employment_type}`)].filter(Boolean).join(" · ")}</span>}
          </div>
          <div className="kanban">
            {STAGES.map((s) => {
              const col = cands.filter((c) => c.stage === s);
              return (
                <div key={s} className={"kcol" + (over === s ? " drop" : "")}
                  onDragOver={(e) => { e.preventDefault(); setOver(s); }}
                  onDragLeave={() => setOver(null)}
                  onDrop={() => { if (dragging) move(dragging, s); setDragging(null); setOver(null); }}>
                  <h3><span>{t(`rec.stage.${s}`)}</span><span className="faint">{col.length}</span></h3>
                  {col.map((c) => (
                    <button key={c.id} className="kcard" draggable onDragStart={() => setDragging(c.id)} onClick={() => setCand(c)}>
                      <b>{c.full_name}</b>
                      <span className="small muted">{c.source || c.email || "—"}</span>
                      <span className="row between small"><Stars n={c.rating} /><span className="faint">{fmt(c.created_at)}</span></span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="small faint">{t("rec.dragHint")}</p>
        </>
      )}

      {editJob && <JobModal job={editJob === "new" ? undefined : editJob} onClose={() => setEditJob(null)} onSaved={(id) => { setJobId(id); reload(); }} />}
      {cand && job && <CandidateModal cand={cand === "new" ? undefined : cand} job={job} onClose={() => setCand(null)} onSaved={reload} />}
    </>
  );
}

function JobModal({ job, onClose, onSaved }: { job?: Job; onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useT();
  const { departments } = useSession();
  const [f, setF] = useState({ title: job?.title ?? "", department_id: job?.department_id ?? "", location: job?.location ?? "", employment_type: job?.employment_type ?? "full_time", description: job?.description ?? "", status: job?.status ?? "open" });
  const [err, setErr] = useState("");
  async function save() {
    if (!f.title.trim()) return setErr(t("rec.errTitle"));
    try {
      const row = { ...f, title: f.title.trim(), department_id: f.department_id || null, location: f.location || null, description: f.description || null };
      const saved = job ? await must(supabase.from("jobs").update(row).eq("id", job.id).select().single()) : await must(supabase.from("jobs").insert(row).select().single());
      onSaved((saved as Job).id);
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  }
  async function remove() {
    if (!job) return;
    await supabase.from("jobs").delete().eq("id", job.id);
    onSaved("");
    onClose();
  }
  return (
    <Modal title={job ? t("rec.editJob") : t("rec.newJob")} onClose={onClose} footer={<>{job && <span style={{ marginRight: "auto" }}><ConfirmButton onConfirm={remove}>{t("common.delete")}</ConfirmButton></span>}<button className="btn" onClick={onClose}>{t("common.cancel")}</button><button className="btn primary" onClick={save}>{t("common.save")}</button></>}>
      <Field label={t("rec.jobTitle")}><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <div className="form-grid">
        <Field label={t("emp.department")}><select value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label={t("emp.location")}><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <Field label={t("rec.empType")}><select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as Job["employment_type"] })}>{(["full_time", "part_time", "contract", "internship"] as const).map((x) => <option key={x} value={x}>{t(`rec.type.${x}`)}</option>)}</select></Field>
        <Field label={t("emp.status")}><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Job["status"] })}>{(["open", "paused", "closed"] as const).map((x) => <option key={x} value={x}>{t(`rec.st.${x}`)}</option>)}</select></Field>
      </div>
      <Field label={t("rec.description")}><textarea rows={6} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}

function CandidateModal({ cand, job, onClose, onSaved }: { cand?: Candidate; job: Job; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const nav = useNavigate();
  const { reload: reloadSession } = useSession();
  const [f, setF] = useState({ full_name: cand?.full_name ?? "", email: cand?.email ?? "", phone: cand?.phone ?? "", source: cand?.source ?? "", stage: cand?.stage ?? ("applied" as Stage), rating: cand?.rating ?? 0, notes: cand?.notes ?? "" });
  const [cv, setCv] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(): Promise<Candidate | null> {
    if (!f.full_name.trim()) { setErr(t("emp.errName")); return null; }
    setBusy(true);
    try {
      let cv_path = cand?.cv_path ?? null;
      if (cv) {
        cv_path = `candidates/${job.id}/${Date.now()}-${cv.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from("documents").upload(cv_path, cv);
        if (error) throw error;
      }
      const row = { job_id: job.id, full_name: f.full_name.trim(), email: f.email || null, phone: f.phone || null, source: f.source || null, stage: f.stage, rating: f.rating || null, notes: f.notes || null, cv_path };
      const saved = cand ? await must(supabase.from("candidates").update(row).eq("id", cand.id).select().single()) : await must(supabase.from("candidates").insert(row).select().single());
      onSaved();
      return saved as Candidate;
    } catch (e) {
      setErr(errMsg(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function openCv() {
    if (!cand?.cv_path) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(cand.cv_path, 60);
    if (error || !data) return toast(errMsg(error), true);
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function hire() {
    const c = await save();
    if (!c) return;
    try {
      const e = (await must(supabase.from("employees").insert({ full_name: c.full_name, email: c.email, phone: c.phone, position: job.title, department_id: job.department_id, status: "onboarding", start_date: today() }).select().single())) as Employee;
      await must(supabase.from("employee_private").insert({ employee_id: e.id }));
      await must(supabase.from("candidates").update({ stage: "hired" }).eq("id", c.id));
      await createDefaultChecklist(e.id, e.start_date, lang);
      await reloadSession();
      toast(t("rec.hired", { name: c.full_name }));
      onClose();
      nav(`/people/${e.id}`);
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  async function remove() {
    if (!cand) return;
    if (cand.cv_path) await supabase.storage.from("documents").remove([cand.cv_path]);
    await supabase.from("candidates").delete().eq("id", cand.id);
    onSaved();
    onClose();
  }

  return (
    <Modal wide title={cand ? cand.full_name : t("rec.newCandidate")} onClose={onClose}
      footer={<>
        {cand && <span style={{ marginRight: "auto" }}><ConfirmButton onConfirm={remove}>{t("common.delete")}</ConfirmButton></span>}
        {cand && cand.stage !== "hired" && <button className="btn" disabled={busy} onClick={hire}><Icon name="check" size={16} /> {t("rec.hire")}</button>}
        <button className="btn" onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn primary" disabled={busy} onClick={async () => { if (await save()) onClose(); }}>{t("common.save")}</button>
      </>}>
      <p className="small muted">{job.title}</p>
      <div className="form-grid">
        <Field label={t("emp.name")} wide><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label={t("emp.email")}><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={t("emp.phone")}><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label={t("rec.source")}><input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="hr.ge, jobs.ge, LinkedIn…" /></Field>
        <Field label={t("rec.stage")}><select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s} value={s}>{t(`rec.stage.${s}`)}</option>)}</select></Field>
        <Field label={t("rec.rating")} wide>
          <div className="rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={f.rating === n} onClick={() => setF({ ...f, rating: f.rating === n ? 0 : n })}>{n}</button>)}</div>
        </Field>
        <Field label={t("rec.notes")} wide><textarea rows={5} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <Field label={t("rec.cv")} wide>
          <div className="row">
            <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCv(e.target.files?.[0] ?? null)} style={{ maxWidth: 320 }} />
            {cand?.cv_path && <button type="button" className="btn sm" onClick={openCv}><Icon name="download" size={15} /> {t("rec.openCv")}</button>}
          </div>
        </Field>
      </div>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}

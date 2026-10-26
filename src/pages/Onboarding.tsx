import { useState } from "react";
import { useT, type Key } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { fmt, today } from "../lib/dates";
import { createDefaultChecklist } from "../lib/onboarding";
import type { Employee, OnboardingTask } from "../lib/types";
import { Badge, ConfirmButton, Empty, Field, Modal, PageHead, Person, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

const CATS = ["docs", "it", "team", "review", "general"] as const;

export function Onboarding() {
  const { t, lang } = useT();
  const toast = useToast();
  const { me, isHR, employees, emp, reload: reloadSession } = useSession();
  const [adding, setAdding] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const { data, reload, setData } = useQuery(async () => (await must(supabase.from("onboarding_tasks").select("*").order("sort").order("created_at"))) as OnboardingTask[], []);
  const tasks = data ?? [];
  const byEmp = new Map<string, OnboardingTask[]>();
  for (const x of tasks) byEmp.set(x.employee_id, [...(byEmp.get(x.employee_id) ?? []), x]);
  const people = [...byEmp.keys()].map((id) => emp(id)).filter((e): e is Employee => !!e);
  people.sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : a.full_name.localeCompare(b.full_name)));

  async function toggle(x: OnboardingTask) {
    setData((xs) => xs?.map((y) => (y.id === x.id ? { ...y, done: !x.done } : y)));
    try {
      await must(supabase.from("onboarding_tasks").update({ done: !x.done, done_at: x.done ? null : new Date().toISOString() }).eq("id", x.id));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  async function remove(id: string) {
    await supabase.from("onboarding_tasks").delete().eq("id", id);
    reload();
  }

  async function activate(e: Employee) {
    try {
      await must(supabase.from("employees").update({ status: "active" }).eq("id", e.id));
      await reloadSession();
      toast(t("onb.activated", { name: e.full_name }));
    } catch (err) {
      toast(errMsg(err), true);
    }
  }

  const without = employees.filter((e) => e.status !== "inactive" && !byEmp.has(e.id));

  return (
    <>
      <PageHead title={t("nav.onboarding")} sub={t("onb.sub")}>
        {isHR && <button className="btn primary" onClick={() => setStarting(true)}><Icon name="rocket" size={16} /> {t("onb.start")}</button>}
      </PageHead>
      {!people.length && <div className="card"><Empty>{isHR ? t("onb.emptyHR") : t("onb.empty")}</Empty></div>}
      <div className="grid cols-2">
        {people.map((e) => {
          const list = byEmp.get(e.id) ?? [];
          const done = list.filter((x) => x.done).length;
          const pct = list.length ? Math.round((done / list.length) * 100) : 0;
          const canToggle = isHR || e.id === me?.id;
          return (
            <section className="card" key={e.id}>
              <div className="card-head">
                <Person emp={e} sub={`${t("emp.start")}: ${fmt(e.start_date)}`} />
                <div className="row">
                  {e.status === "onboarding" ? <Badge tone="info">{t("emp.st.onboarding")}</Badge> : <Badge tone="ok">{t("emp.st.active")}</Badge>}
                  <span className="num small muted">{done}/{list.length}</span>
                </div>
              </div>
              <div style={{ padding: "12px 18px 0" }}><div className={"bar" + (pct === 100 ? " ok" : "")}><i style={{ width: `${pct}%` }} /></div></div>
              <div className="list checklist">
                {list.map((x) => (
                  <div className={"item" + (x.done ? " done" : "")} key={x.id}>
                    <input type="checkbox" checked={x.done} disabled={!canToggle} onChange={() => toggle(x)} aria-label={x.title} />
                    <div className="grow"><b>{x.title}</b><span>{t(`onb.cat.${x.category}` as Key)}{x.due_date ? ` · ${fmt(x.due_date)}` : ""}{!x.done && x.due_date && x.due_date < today() ? ` · ${t("onb.overdue")}` : ""}</span></div>
                    {isHR && <ConfirmButton className="btn ghost sm" onConfirm={() => remove(x.id)}><Icon name="trash" size={14} /></ConfirmButton>}
                  </div>
                ))}
              </div>
              {isHR && (
                <div className="row" style={{ padding: "10px 18px 14px" }}>
                  <button className="btn sm" onClick={() => setAdding(e.id)}><Icon name="plus" size={14} /> {t("onb.addTask")}</button>
                  {e.status === "onboarding" && pct === 100 && <button className="btn primary sm" onClick={() => activate(e)}>{t("onb.finish")}</button>}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {adding && <TaskModal employeeId={adding} onClose={() => setAdding(null)} onSaved={reload} />}
      {starting && (
        <Modal title={t("onb.start")} onClose={() => setStarting(false)}>
          <p className="small muted">{t("onb.startHint")}</p>
          <div className="list">
            {without.map((e) => (
              <div className="item" key={e.id}>
                <div className="grow"><Person emp={e} link={false} /></div>
                <button className="btn sm" onClick={async () => { try { await createDefaultChecklist(e.id, e.start_date, lang); setStarting(false); reload(); } catch (err) { toast(errMsg(err), true); } }}>{t("onb.createList")}</button>
              </div>
            ))}
            {!without.length && <Empty>{t("onb.allHave")}</Empty>}
          </div>
        </Modal>
      )}
    </>
  );
}

function TaskModal({ employeeId, onClose, onSaved }: { employeeId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [due, setDue] = useState("");
  const [err, setErr] = useState("");
  async function save() {
    if (!title.trim()) return;
    try {
      await must(supabase.from("onboarding_tasks").insert({ employee_id: employeeId, title: title.trim(), category, due_date: due || null, sort: 100 }));
      onSaved();
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  }
  return (
    <Modal title={t("onb.addTask")} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t("common.cancel")}</button><button className="btn primary" onClick={save}>{t("common.save")}</button></>}>
      <Field label={t("onb.task")}><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="form-grid">
        <Field label={t("onb.category")}><select value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{t(`onb.cat.${c}`)}</option>)}</select></Field>
        <Field label={t("perf.due")}><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}

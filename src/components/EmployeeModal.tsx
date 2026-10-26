import { useEffect, useState } from "react";
import { ConfirmButton, Field, Modal, useToast } from "./ui";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { errMsg, must, supabase } from "../lib/supabase";
import { today } from "../lib/dates";
import { createDefaultChecklist } from "../lib/onboarding";
import type { Employee, EmployeePrivate, EmployeeStatus } from "../lib/types";

type Form = {
  full_name: string; email: string; phone: string; position: string; department_id: string; manager_id: string;
  birth_date: string; start_date: string; status: EmployeeStatus; location: string;
  personal_id: string; address: string; emergency_contact: string; bank_account: string; salary: string; pension: boolean;
};

export function EmployeeModal({ employee, onClose, onSaved, initial }: { employee?: Employee; onClose: () => void; onSaved: (id: string) => void; initial?: Partial<Form> }) {
  const { t, lang } = useT();
  const toast = useToast();
  const { employees, departments, reload } = useSession();
  const [f, setF] = useState<Form>({
    full_name: employee?.full_name ?? "", email: employee?.email ?? "", phone: employee?.phone ?? "", position: employee?.position ?? "",
    department_id: employee?.department_id ?? "", manager_id: employee?.manager_id ?? "", birth_date: employee?.birth_date ?? "",
    start_date: employee?.start_date ?? today(), status: employee?.status ?? "active", location: employee?.location ?? "",
    personal_id: "", address: "", emergency_contact: "", bank_account: "", salary: "", pension: true, ...initial,
  });
  const [checklist, setChecklist] = useState(!employee);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!employee) return;
    supabase.from("employee_private").select("*").eq("employee_id", employee.id).maybeSingle().then(({ data }) => {
      const p = data as EmployeePrivate | null;
      if (p) setF((x) => ({ ...x, personal_id: p.personal_id ?? "", address: p.address ?? "", emergency_contact: p.emergency_contact ?? "", bank_account: p.bank_account ?? "", salary: String(p.salary ?? ""), pension: p.pension }));
    });
  }, [employee]);

  const set = <K extends keyof Form>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function save() {
    setErr("");
    if (!f.full_name.trim()) return setErr(t("emp.errName"));
    if (f.personal_id && !/^\d{11}$/.test(f.personal_id)) return setErr(t("emp.errPid"));
    setBusy(true);
    try {
      const row = {
        full_name: f.full_name.trim(), email: f.email.trim() || null, phone: f.phone.trim() || null, position: f.position.trim() || null,
        department_id: f.department_id || null, manager_id: f.manager_id || null, birth_date: f.birth_date || null,
        start_date: f.start_date || null, status: f.status, location: f.location.trim() || null,
      };
      const saved = employee
        ? await must(supabase.from("employees").update(row).eq("id", employee.id).select().single())
        : await must(supabase.from("employees").insert(row).select().single());
      const id = (saved as Employee).id;
      await must(supabase.from("employee_private").upsert({
        employee_id: id, personal_id: f.personal_id || null, address: f.address || null, emergency_contact: f.emergency_contact || null,
        bank_account: f.bank_account || null, salary: Number(f.salary) || 0, pension: f.pension,
      }));
      if (!employee && checklist) await createDefaultChecklist(id, row.start_date, lang);
      await reload();
      toast(employee ? t("common.saved") : t("emp.added"));
      onSaved(id);
      onClose();
    } catch (e) {
      const m = errMsg(e);
      setErr(m.includes("employees_email_key") ? t("emp.errEmail") : m);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!employee) return;
    try {
      await must(supabase.from("employees").delete().eq("id", employee.id));
      await reload();
      toast(t("emp.deleted"));
      onClose();
      window.history.back();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  const managers = employees.filter((e) => e.id !== employee?.id && e.status !== "inactive");

  return (
    <Modal
      wide
      title={employee ? t("emp.edit") : t("emp.new")}
      onClose={onClose}
      footer={
        <>
          {employee && <span style={{ marginRight: "auto" }}><ConfirmButton onConfirm={remove}>{t("common.delete")}</ConfirmButton></span>}
          <button className="btn" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn primary" disabled={busy} onClick={save}>{t("common.save")}</button>
        </>
      }
    >
      <h3>{t("emp.secJob")}</h3>
      <div className="form-grid">
        <Field label={t("emp.name")} wide><input value={f.full_name} onChange={set("full_name")} required /></Field>
        <Field label={t("emp.email")} hint={t("emp.emailHint")}><input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label={t("emp.phone")}><input type="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label={t("emp.position")}><input value={f.position} onChange={set("position")} /></Field>
        <Field label={t("emp.department")}>
          <select value={f.department_id} onChange={set("department_id")}>
            <option value="">—</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label={t("emp.manager")}>
          <select value={f.manager_id} onChange={set("manager_id")}>
            <option value="">—</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </Field>
        <Field label={t("emp.location")}><input value={f.location} onChange={set("location")} /></Field>
        <Field label={t("emp.start")}><input type="date" value={f.start_date} onChange={set("start_date")} /></Field>
        <Field label={t("emp.status")}>
          <select value={f.status} onChange={set("status")}>
            {(["onboarding", "active", "inactive"] as EmployeeStatus[]).map((s) => <option key={s} value={s}>{t(`emp.st.${s}`)}</option>)}
          </select>
        </Field>
        <Field label={t("emp.birth")}><input type="date" value={f.birth_date} onChange={set("birth_date")} /></Field>
      </div>
      <h3>{t("emp.secPrivate")}</h3>
      <div className="form-grid">
        <Field label={t("emp.salary")}><input type="number" min="0" step="0.01" value={f.salary} onChange={set("salary")} /></Field>
        <Field label={t("emp.pid")}><input inputMode="numeric" maxLength={11} value={f.personal_id} onChange={set("personal_id")} /></Field>
        <Field label={t("emp.address")} wide><input value={f.address} onChange={set("address")} /></Field>
        <Field label={t("emp.bank")}><input value={f.bank_account} onChange={set("bank_account")} placeholder="GE00TB0000000000000000" /></Field>
        <Field label={t("emp.emergency")}><input value={f.emergency_contact} onChange={set("emergency_contact")} /></Field>
        <label className="check wide"><input type="checkbox" checked={f.pension} onChange={set("pension")} /> {t("emp.pension")}</label>
        {!employee && <label className="check wide"><input type="checkbox" checked={checklist} onChange={(e) => setChecklist(e.target.checked)} /> {t("emp.createChecklist")}</label>}
      </div>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}

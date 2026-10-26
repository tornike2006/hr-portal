import { useState } from "react";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { errMsg, must, supabase } from "../lib/supabase";
import type { Department, Role, Settings } from "../lib/types";
import { ConfirmButton, Empty, Field, PageHead, Person, Seg, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

type Tab = "company" | "departments" | "users";

export function SettingsPage() {
  const { t } = useT();
  const { isAdmin } = useSession();
  const [tab, setTab] = useState<Tab>("company");
  const tabs: [Tab, string][] = [["company", t("set.company")], ["departments", t("set.departments")]];
  if (isAdmin) tabs.push(["users", t("set.users")]);
  return (
    <>
      <PageHead title={t("nav.settings")} />
      <Seg value={tab} onChange={setTab} options={tabs} />
      {tab === "company" && <CompanyForm />}
      {tab === "departments" && <Departments />}
      {tab === "users" && isAdmin && <Users />}
    </>
  );
}

function CompanyForm() {
  const { t } = useT();
  const toast = useToast();
  const { settings, reload } = useSession();
  const [f, setF] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      await must(supabase.from("company_settings").update({ ...f, annual_leave: Math.max(24, Number(f.annual_leave) || 24), updated_at: new Date().toISOString() }).eq("id", 1));
      await reload();
      toast(t("common.saved"));
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-body stack lg" style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <Field label={t("set.companyName")} wide><input value={f.company} onChange={set("company")} placeholder="შპს „მაგალითი“" /></Field>
          <Field label={t("set.code")}><input inputMode="numeric" value={f.company_code} onChange={set("company_code")} /></Field>
          <Field label={t("set.city")}><input value={f.city} onChange={set("city")} /></Field>
          <Field label={t("set.address")} wide><input value={f.address} onChange={set("address")} /></Field>
          <Field label={t("set.director")}><input value={f.director} onChange={set("director")} /></Field>
        </div>
        <div className="form-grid">
          <Field label={t("set.week")}>
            <select value={f.six_day_week ? "6" : "5"} onChange={(e) => setF({ ...f, six_day_week: e.target.value === "6" })}>
              <option value="5">{t("set.week5")}</option>
              <option value="6">{t("set.week6")}</option>
            </select>
          </Field>
          <Field label={t("set.annual")} hint={t("set.annualHint")}><input type="number" min={24} max={60} value={f.annual_leave} onChange={(e) => setF({ ...f, annual_leave: Number(e.target.value) })} /></Field>
        </div>
        <div><button className="btn primary" disabled={busy} onClick={save}>{t("common.save")}</button></div>
      </div>
    </section>
  );
}

function Departments() {
  const { t } = useT();
  const toast = useToast();
  const { departments, employees, reload } = useSession();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function add() {
    if (!name.trim()) return;
    try {
      await must(supabase.from("departments").insert({ name: name.trim() }));
      setName("");
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }
  async function rename(d: Department) {
    const n = editing[d.id]?.trim();
    if (!n || n === d.name) return;
    await supabase.from("departments").update({ name: n }).eq("id", d.id);
    reload();
  }
  async function remove(d: Department) {
    await supabase.from("departments").delete().eq("id", d.id);
    reload();
  }

  return (
    <section className="card">
      <div className="card-head">
        <form className="row" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("set.newDept")} style={{ width: 260 }} aria-label={t("set.newDept")} />
          <button className="btn primary"><Icon name="plus" size={15} /> {t("common.add")}</button>
        </form>
      </div>
      <div className="list">
        {departments.length ? departments.map((d) => (
          <div className="item" key={d.id}>
            <input className="grow" style={{ maxWidth: 320 }} value={editing[d.id] ?? d.name} onChange={(e) => setEditing({ ...editing, [d.id]: e.target.value })} onBlur={() => rename(d)} aria-label={t("set.departments")} />
            <span className="small muted grow">{t("people.count", { n: employees.filter((e) => e.department_id === d.id && e.status !== "inactive").length })}</span>
            <ConfirmButton className="btn ghost sm danger" onConfirm={() => remove(d)}>{t("common.delete")}</ConfirmButton>
          </div>
        )) : <Empty>{t("set.noDepts")}</Empty>}
      </div>
    </section>
  );
}

function Users() {
  const { t } = useT();
  const toast = useToast();
  const { profiles, emp, session, reload } = useSession();

  async function setRole(id: string, role: Role) {
    try {
      await must(supabase.from("profiles").update({ role }).eq("id", id));
      await reload();
      toast(t("common.saved"));
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <section className="card">
      <div className="card-head"><p className="small muted">{t("set.usersHint")}</p></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("auth.email")}</th><th>{t("common.employee")}</th><th>{t("set.role")}</th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.email}</td>
                <td>{p.employee_id ? <Person emp={emp(p.employee_id)} size={28} /> : <span className="faint small">{t("set.notLinked")}</span>}</td>
                <td>
                  <select style={{ width: "auto" }} value={p.role} disabled={p.id === session?.user.id} onChange={(e) => setRole(p.id, e.target.value as Role)} aria-label={t("set.role")}>
                    <option value="employee">{t("role.employee")}</option>
                    <option value="hr">{t("role.hr")}</option>
                    <option value="admin">{t("role.admin")}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

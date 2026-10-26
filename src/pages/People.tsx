import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { fmt } from "../lib/dates";
import { Avatar, Badge, Empty, PageHead, Person, Seg } from "../components/ui";
import { Icon } from "../components/Icon";
import { EmployeeModal } from "../components/EmployeeModal";

export function People() {
  const { t } = useT();
  const nav = useNavigate();
  const { employees, departments, dept, emp, isHR } = useSession();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [d, setD] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees
      .filter((e) => showInactive || e.status !== "inactive")
      .filter((e) => !d || e.department_id === d)
      .filter((e) => !s || [e.full_name, e.position, e.email, e.phone, dept(e.department_id)?.name].join(" ").toLowerCase().includes(s));
  }, [employees, q, d, showInactive, dept]);

  return (
    <>
      <PageHead title={t("nav.people")} sub={t("people.count", { n: employees.filter((e) => e.status !== "inactive").length })}>
        {isHR && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> {t("emp.new")}</button>}
      </PageHead>

      <div className="row between">
        <div className="row grow">
          <input type="search" style={{ maxWidth: 320 }} placeholder={t("people.search")} value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} aria-label={t("people.search")} />
          <select style={{ width: "auto" }} value={d} onChange={(e) => setD(e.target.value)} aria-label={t("emp.department")}>
            <option value="">{t("people.allDepts")}</option>
            {departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          {isHR && <label className="check small"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> {t("people.showInactive")}</label>}
        </div>
        <Seg value={view} onChange={setView} options={[["cards", t("people.cards")], ["table", t("people.table")]]} />
      </div>

      {!employees.length ? (
        <div className="card">
          <Empty action={isHR && <button className="btn primary" onClick={() => setAdding(true)}>{t("emp.new")}</button>}>{t("people.empty")}</Empty>
        </div>
      ) : view === "cards" ? (
        <div className="people-grid">
          {list.map((e) => (
            <Link key={e.id} to={`/people/${e.id}`} className="pcard">
              <Avatar emp={e} size={64} />
              <div>
                <div className="nm">{e.full_name}</div>
                <div className="ps">{e.position || "—"}</div>
              </div>
              <div className="row" style={{ justifyContent: "center" }}>
                {dept(e.department_id) && <Badge>{dept(e.department_id)!.name}</Badge>}
                {e.status !== "active" && <Badge tone={e.status === "onboarding" ? "info" : "mute"}>{t(`emp.st.${e.status}`)}</Badge>}
              </div>
            </Link>
          ))}
          {!list.length && <p className="muted">{t("common.noResults")}</p>}
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>{t("common.employee")}</th><th>{t("emp.department")}</th><th>{t("emp.manager")}</th><th>{t("emp.email")}</th><th>{t("emp.phone")}</th><th>{t("emp.start")}</th><th>{t("emp.status")}</th></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="click" onClick={() => nav(`/people/${e.id}`)}>
                  <td><Person emp={e} size={30} link={false} sub={e.position ?? ""} /></td>
                  <td>{dept(e.department_id)?.name ?? "—"}</td>
                  <td>{emp(e.manager_id)?.full_name ?? "—"}</td>
                  <td>{e.email ?? "—"}</td>
                  <td className="nowrap">{e.phone ?? "—"}</td>
                  <td>{fmt(e.start_date)}</td>
                  <td><Badge tone={e.status === "active" ? "ok" : e.status === "onboarding" ? "info" : "mute"}>{t(`emp.st.${e.status}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <EmployeeModal onClose={() => setAdding(false)} onSaved={(id) => nav(`/people/${id}`)} />}
    </>
  );
}

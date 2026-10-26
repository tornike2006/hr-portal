import { Link } from "react-router-dom";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import type { Employee } from "../lib/types";
import { Avatar, Empty, PageHead } from "../components/ui";

export function OrgChart() {
  const { t } = useT();
  const { employees, dept } = useSession();
  const active = employees.filter((e) => e.status !== "inactive");
  const ids = new Set(active.map((e) => e.id));
  const children = new Map<string, Employee[]>();
  for (const e of active) {
    if (e.manager_id && ids.has(e.manager_id)) {
      const xs = children.get(e.manager_id) ?? [];
      xs.push(e);
      children.set(e.manager_id, xs);
    }
  }
  const roots = active.filter((e) => !e.manager_id || !ids.has(e.manager_id));

  const node = (e: Employee, seen: Set<string>): JSX.Element => {
    const kids = seen.has(e.id) ? [] : children.get(e.id) ?? [];
    const next = new Set(seen).add(e.id);
    return (
      <li key={e.id}>
        <Link to={`/people/${e.id}`} className="org-node">
          <Avatar emp={e} size={44} />
          <span className="nm">{e.full_name}</span>
          <span className="ps">{e.position || "—"}{dept(e.department_id) ? ` · ${dept(e.department_id)!.name}` : ""}</span>
          {kids.length > 0 && <span className="faint small">{t("org.reports", { n: kids.length })}</span>}
        </Link>
        {kids.length > 0 && <ul>{kids.map((k) => node(k, next))}</ul>}
      </li>
    );
  };

  return (
    <>
      <PageHead title={t("nav.org")} sub={t("org.sub")} />
      <section className="card">
        {active.length ? (
          <div className="org">
            <ul>{roots.map((r) => node(r, new Set()))}</ul>
          </div>
        ) : (
          <Empty>{t("people.empty")}</Empty>
        )}
      </section>
    </>
  );
}

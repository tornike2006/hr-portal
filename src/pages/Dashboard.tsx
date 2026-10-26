import { useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { ageOn, fmt, holidays, iso, nextBirthday, parse, today } from "../lib/dates";
import { decideLeave, paidUsed } from "../lib/leave";
import type { Absence, Announcement, Goal, LeaveRequest, OnboardingTask } from "../lib/types";
import { Badge, Empty, Person, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { LeaveModal } from "../components/LeaveModal";

export function Dashboard() {
  const { t, df, lang } = useT();
  const toast = useToast();
  const { me, isHR, isManager, employees, emp, settings, profile } = useSession();
  const [askLeave, setAskLeave] = useState(false);
  const now = new Date();
  const td = today();

  const { data, reload } = useQuery(async () => {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const [leaves, absences, news, tasks, goals] = await Promise.all([
      must(supabase.from("leave_requests").select("*").order("start_date")),
      must(supabase.from("absences").select("*").lte("start_date", iso(weekEnd)).gte("end_date", td)),
      must(supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3)),
      me ? must(supabase.from("onboarding_tasks").select("*").eq("employee_id", me.id).eq("done", false).order("sort")) : Promise.resolve([]),
      me ? must(supabase.from("goals").select("*").eq("employee_id", me.id).neq("status", "done").order("due_date")) : Promise.resolve([]),
    ]);
    return {
      leaves: leaves as LeaveRequest[],
      absences: absences as Absence[],
      news: news as Announcement[],
      tasks: tasks as OnboardingTask[],
      goals: goals as Goal[],
    };
  }, [me?.id]);

  const leaves = data?.leaves ?? [];
  const approvals = leaves.filter((l) => l.status === "pending" && l.employee_id !== me?.id);
  const out = (data?.absences ?? []).filter((a) => emp(a.employee_id));
  const outToday = out.filter((a) => a.start_date <= td && a.end_date >= td);
  const active = employees.filter((e) => e.status !== "inactive");
  const used = me ? paidUsed(leaves, me.id, now.getFullYear()) : 0;

  const limit = new Date(now);
  limit.setDate(limit.getDate() + 30);
  const celebrations = active
    .flatMap((e) => {
      const r: { e: typeof e; d: Date; kind: "bday" | "anniv"; n: number }[] = [];
      if (e.birth_date) {
        const d = nextBirthday(e.birth_date, now);
        if (d <= limit) r.push({ e, d, kind: "bday", n: ageOn(e.birth_date, d) });
      }
      if (e.start_date) {
        const d = nextBirthday(e.start_date, now);
        const years = d.getFullYear() - parse(e.start_date).getFullYear();
        if (d <= limit && years > 0) r.push({ e, d, kind: "anniv", n: years });
      }
      return r;
    })
    .sort((a, b) => +a.d - +b.d)
    .slice(0, 8);

  const y = now.getFullYear();
  const nextHolidays = [...holidays(y).entries(), ...[...holidays(y + 1).entries()].map(([k, v]) => [`n${k}`, v] as const)]
    .map(([k, v]) => ({ date: k.startsWith("n") ? `${y + 1}-${k.slice(1)}` : `${y}-${k}`, name: lang === "ka" ? v[0] : v[1] }))
    .filter((h) => h.date >= td)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  async function decide(id: string, ok: boolean) {
    try {
      await decideLeave(id, ok);
      toast(ok ? t("leave.approved") : t("leave.rejected"));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  const hello = now.getHours() < 12 ? t("dash.morning") : now.getHours() < 18 ? t("dash.afternoon") : t("dash.evening");
  const first = (me?.full_name ?? profile?.email ?? "").split(/[\s@]/)[0];

  return (
    <>
      <section className="welcome">
        <div>
          <h1>{hello}, {first}</h1>
          <p>{df(now, "full")}{settings.company ? ` · ${settings.company}` : ""}</p>
        </div>
        <div className="row">
          {me && <button className="btn" onClick={() => setAskLeave(true)}><Icon name="plane" size={16} /> {t("leave.request")}</button>}
          <Link className="btn" to="/chat"><Icon name="chat" size={16} /> {t("nav.chat")}</Link>
        </div>
      </section>

      <div className="stats">
        {me && <div className="stat"><b>{settings.annual_leave - used}</b><span>{t("dash.leaveLeft", { y })}</span></div>}
        <div className="stat"><b>{outToday.length}</b><span>{t("dash.outToday")}</span></div>
        {(isHR || isManager) && <div className="stat"><b>{approvals.length}</b><span>{t("dash.toApprove")}</span></div>}
        {isHR && <div className="stat"><b>{active.length}</b><span>{t("dash.headcount")}</span></div>}
        {me && <div className="stat"><b>{data?.tasks.length ?? 0}</b><span>{t("dash.myTasks")}</span></div>}
      </div>

      {isHR && !settings.company && (
        <p className="notice info">{t("dash.setupCompany")} <Link to="/settings">{t("nav.settings")} →</Link></p>
      )}

      <div className="dash">
        <div className="stack lg">
          {(isHR || isManager) && approvals.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>{t("dash.toApprove")}</h2><Link to="/time-off" className="btn ghost sm">{t("common.all")} →</Link></div>
              <div className="list">
                {approvals.slice(0, 6).map((l) => (
                  <div className="item" key={l.id}>
                    <div className="grow"><Person emp={emp(l.employee_id)} sub={`${t(`leave.t.${l.type}`)} · ${fmt(l.start_date)} – ${fmt(l.end_date)} · ${t("leave.daysShort", { n: l.days })}`} /></div>
                    <button className="btn sm" onClick={() => decide(l.id, true)}>{t("leave.approve")}</button>
                    <button className="btn sm danger" onClick={() => decide(l.id, false)}>{t("leave.reject")}</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>{t("nav.announcements")}</h2><Link to="/announcements" className="btn ghost sm">{t("common.all")} →</Link></div>
            <div className="list">
              {data?.news.length ? data.news.map((a) => (
                <article className="announce" key={a.id}>
                  <div className="row between">
                    <h3>{a.title}</h3>
                    {a.pinned && <Badge tone="accent">{t("news.pinned")}</Badge>}
                  </div>
                  <p className="txt">{a.body.length > 280 ? a.body.slice(0, 280) + "…" : a.body}</p>
                  <span className="faint small">{fmt(a.created_at)}</span>
                </article>
              )) : <Empty>{t("news.empty")}</Empty>}
            </div>
          </section>

          {me && (data?.goals.length || data?.tasks.length) ? (
            <div className="grid cols-2">
              {!!data?.tasks.length && (
                <section className="card">
                  <div className="card-head"><h2>{t("dash.myOnboarding")}</h2><Link to="/onboarding" className="btn ghost sm">→</Link></div>
                  <div className="list">
                    {data.tasks.slice(0, 5).map((x) => (
                      <div className="item" key={x.id}><span className="dot" style={{ background: "var(--warn)" }} /><div className="grow"><b>{x.title}</b>{x.due_date && <span>{fmt(x.due_date)}</span>}</div></div>
                    ))}
                  </div>
                </section>
              )}
              {!!data?.goals.length && (
                <section className="card">
                  <div className="card-head"><h2>{t("dash.myGoals")}</h2><Link to="/performance" className="btn ghost sm">→</Link></div>
                  <div className="list">
                    {data.goals.slice(0, 5).map((g) => (
                      <div className="item" key={g.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                        <div className="row between"><b>{g.title}</b><span className="small muted num">{g.progress}%</span></div>
                        <div className={"bar" + (g.status === "at_risk" ? " warn" : "")}><i style={{ width: `${g.progress}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </div>

        <div className="stack lg">
          <section className="card">
            <div className="card-head"><h2>{t("dash.whoOut")}</h2></div>
            <div className="list">
              {out.length ? out.slice(0, 8).map((a) => (
                <div className="item" key={a.id}>
                  <div className="grow"><Person emp={emp(a.employee_id)} size={30} sub={`${fmt(a.start_date)} – ${fmt(a.end_date)}`} /></div>
                  {a.start_date <= td && <Badge tone="warn">{t("dash.today")}</Badge>}
                </div>
              )) : <Empty>{t("dash.everyoneIn")}</Empty>}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>{t("dash.celebrations")}</h2></div>
            <div className="list">
              {celebrations.length ? celebrations.map((c) => (
                <div className={"item" + (iso(c.d) === td ? " hl" : "")} key={c.e.id + c.kind}>
                  <div className="grow">
                    <Person emp={c.e} size={30} sub={`${df(c.d, "dm")} · ${c.kind === "bday" ? t("dash.turns", { n: c.n }) : t("dash.anniv", { n: c.n })}`} />
                  </div>
                  <Icon name={c.kind === "bday" ? "cake" : "star"} />
                </div>
              )) : <Empty>{t("dash.noCelebrations")}</Empty>}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>{t("dash.holidays")}</h2></div>
            <div className="list">
              {nextHolidays.map((h) => (
                <div className="item" key={h.date}><div className="grow"><b>{h.name}</b></div><span className="small muted">{df(parse(h.date), "short")}</span></div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {askLeave && <LeaveModal leaves={leaves} employeeId={me?.id} onClose={() => setAskLeave(false)} onSaved={reload} />}
    </>
  );
}
